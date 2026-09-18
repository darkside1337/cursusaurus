import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  type TestDb,
} from "../helpers";
import { reconcileAttempts, purchases } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GET } from "@/app/api/order-status/[sessionId]/route";

let testDb: TestDb;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const mockRetrieve = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => mockRetrieve(...args),
      },
    },
  },
}));

let mockUser: { id: string; email: string } | null = null;
vi.mock("@/lib/auth", () => ({
  getServerSession: vi.fn(async () => {
    if (!mockUser) return null;
    return {
      user: {
        id: mockUser.id,
        email: mockUser.email,
        name: "Test User",
      },
      session: {
        id: "sess_test",
        userId: mockUser.id,
      },
    };
  }),
}));

describe("P3-3: Atomic Reconcile Claim & TOCTOU Race Protection", () => {
  let user: { id: string; email: string };
  let course: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "reconcile-race@example.com" });
    mockUser = user;
    const creator = await seedUser(testDb, { name: "Author" });
    course = await seedCourse(testDb, {
      creatorId: creator.id,
      priceCents: 4900,
      isPublished: true,
    });
  });

  it("atomic claim prevents concurrent duplicate reconciliation executions", async () => {
    const sessionId = "cs_concurrent_reconcile_1";

    // Simulate delayed Stripe response to widen the race window
    mockRetrieve.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        id: sessionId,
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_race_1",
        amount_total: 4900,
        metadata: {
          userId: user.id,
          courseId: course.id,
        },
      };
    });

    const req1 = new Request(`http://localhost/api/order-status/${sessionId}`);
    const req2 = new Request(`http://localhost/api/order-status/${sessionId}`);

    // Fire both requests concurrently
    const [res1, res2] = await Promise.all([
      GET(req1, { params: Promise.resolve({ sessionId }) }),
      GET(req2, { params: Promise.resolve({ sessionId }) }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const body1 = await res1.json();
    const body2 = await res2.json();

    // Exactly one must be completed, and the other must be pending (blocked by atomic claim)
    const completedCount = [body1, body2].filter((b) => b.status === "completed").length;
    const pendingCount = [body1, body2].filter((b) => b.status === "pending").length;

    expect(completedCount).toBe(1);
    expect(pendingCount).toBe(1);

    // Stripe retrieve should only be called once because the second was rejected by the claim
    expect(mockRetrieve).toHaveBeenCalledTimes(1);

    // Verify reconcile_attempts row status is completed
    const [attempt] = await testDb
      .select()
      .from(reconcileAttempts)
      .where(eq(reconcileAttempts.stripeSessionId, sessionId));

    expect(attempt).toBeDefined();
    expect(attempt?.status).toBe("completed");
    expect(attempt?.userId).toBe(user.id);

    // Verify only ONE purchase was created in DB
    const allPurchases = await testDb
      .select()
      .from(purchases)
      .where(eq(purchases.stripeSessionId, sessionId));
    expect(allPurchases).toHaveLength(1);
  });
});
