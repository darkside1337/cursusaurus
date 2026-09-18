import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLesson,
  seedPurchase,
  seedSubscription,
  seedEntitlement,
  type TestDb,
} from "../helpers";
import { reconcileAttempts, purchases } from "@/db/schema";
import { eq } from "drizzle-orm";

let testDb: TestDb;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const mockStripeSessionsRetrieve = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => mockStripeSessionsRetrieve(...args),
      },
    },
    subscriptions: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        customer: "cus_mock_sub",
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        cancel_at_period_end: false,
        items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
      })),
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

import { GET } from "@/app/api/order-status/[sessionId]/route";

describe("Slice 3 — Order Status API & Reconciliation Route", () => {
  let user: { id: string; email: string };
  let otherUser: { id: string; email: string };
  let course: { id: string; title: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "owner@example.com" });
    otherUser = await seedUser(testDb, { email: "other@example.com" });
    const creator = await seedUser(testDb, { name: "Teacher" });
    course = await seedCourse(testDb, {
      creatorId: creator.id,
      title: "Design Systems",
      slug: "design-systems",
      priceCents: 4900,
      isPublished: true,
    });
    await seedLesson(testDb, { courseId: course.id });

    mockUser = user;
  });

  it("returns 401 when request is unauthenticated", async () => {
    mockUser = null;
    const req = new Request("http://localhost/api/order-status/cs_test_123");
    const res = await GET(req, { params: Promise.resolve({ sessionId: "cs_test_123" }) });

    expect(res.status).toBe(401);
  });

  it("returns 404 when order exists but belongs to a different user (ownership isolation)", async () => {
    await seedPurchase(testDb, {
      userId: otherUser.id, // owned by otherUser
      courseId: course.id,
      stripeSessionId: "cs_unowned_123",
      status: "completed",
    });

    const req = new Request("http://localhost/api/order-status/cs_unowned_123");
    const res = await GET(req, { params: Promise.resolve({ sessionId: "cs_unowned_123" }) });

    expect(res.status).toBe(404);
  });

  it("DB-first lookup: returns completed purchase order status without calling Stripe", async () => {
    await seedPurchase(testDb, {
      userId: user.id,
      courseId: course.id,
      stripeSessionId: "cs_owned_purchase_123",
      status: "completed",
    });
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: course.id,
      source: "purchase",
    });

    const req = new Request("http://localhost/api/order-status/cs_owned_purchase_123");
    const res = await GET(req, { params: Promise.resolve({ sessionId: "cs_owned_purchase_123" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: "completed",
      type: "purchase",
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      isEntitled: true,
    });
    expect(mockStripeSessionsRetrieve).not.toHaveBeenCalled();
  });

  it("DB-first lookup: returns completed subscription order status without undefined route bugs", async () => {
    await seedSubscription(testDb, {
      userId: user.id,
      stripeSessionId: "cs_owned_sub_123",
      status: "active",
    });
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
    });

    const req = new Request("http://localhost/api/order-status/cs_owned_sub_123");
    const res = await GET(req, { params: Promise.resolve({ sessionId: "cs_owned_sub_123" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: "completed",
      type: "subscription",
      isEntitled: true,
    });
    // For subscriptions, courseSlug is not present (avoids /undefined bug)
    expect(body.courseSlug).toBeUndefined();
    expect(mockStripeSessionsRetrieve).not.toHaveBeenCalled();
  });

  it("on-demand single-shot reconcile: fulfills missing session and records reconcile_attempts", async () => {
    mockStripeSessionsRetrieve.mockResolvedValue({
      id: "cs_to_reconcile_123",
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_reconcile_123",
      amount_total: 4900,
      metadata: {
        userId: user.id,
        courseId: course.id,
      },
    });

    const req = new Request("http://localhost/api/order-status/cs_to_reconcile_123");
    const res = await GET(req, { params: Promise.resolve({ sessionId: "cs_to_reconcile_123" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("completed");
    expect(body.isEntitled).toBe(true);

    // Verify reconcile_attempts row was created
    const [attempt] = await testDb
      .select()
      .from(reconcileAttempts)
      .where(eq(reconcileAttempts.stripeSessionId, "cs_to_reconcile_123"));
    expect(attempt).toBeDefined();

    // Verify purchase was recorded in database
    const [purchase] = await testDb
      .select()
      .from(purchases)
      .where(eq(purchases.stripeSessionId, "cs_to_reconcile_123"));
    expect(purchase).toBeDefined();
    expect(purchase.status).toBe("completed");
  });

  it("leaves reconcile_attempts empty on Stripe retrieve failure so later polls can retry (Fix 7)", async () => {
    mockStripeSessionsRetrieve.mockRejectedValue(new Error("Network timeout"));

    const req = new Request("http://localhost/api/order-status/cs_timeout_123");
    const res = await GET(req, { params: Promise.resolve({ sessionId: "cs_timeout_123" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");

    const [attempt] = await testDb
      .select()
      .from(reconcileAttempts)
      .where(eq(reconcileAttempts.stripeSessionId, "cs_timeout_123"));
    expect(attempt).toBeUndefined(); // Can retry!
  });
});
