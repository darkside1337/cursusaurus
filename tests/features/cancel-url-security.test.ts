import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  type TestDb,
} from "../helpers";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

const mockStripeSessionsCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeSessionsCreate(...args),
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

import { createSubscriptionCheckoutSessionAction } from "@/features/subscriptions/actions";

describe("P2-5: Subscription Checkout callbackUrl Open-Redirect Security", () => {
  let user: { id: string; email: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    mockStripeSessionsCreate.mockResolvedValue({
      id: "cs_mock_sec_123",
      url: "https://checkout.stripe.com/c/pay/cs_mock_sec_123",
    });

    user = await seedUser(testDb, { email: "sec-user@example.com" });
    mockUser = user;
  });

  it("sanitizes external https callbackUrl to default /billing in cancel_url", async () => {
    const res = await createSubscriptionCheckoutSessionAction("https://evil.com/phish");

    expect(res.url).toBe("https://checkout.stripe.com/c/pay/cs_mock_sec_123");
    expect(mockStripeSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url: expect.stringMatching(/\/billing$/),
      })
    );
    expect(mockStripeSessionsCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url: expect.stringContaining("evil.com"),
      })
    );
  });

  it("sanitizes protocol-relative //evil.com callbackUrl to default /billing in cancel_url", async () => {
    await createSubscriptionCheckoutSessionAction("//evil.com");

    expect(mockStripeSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url: expect.stringMatching(/\/billing$/),
      })
    );
  });

  it("preserves valid relative path in cancel_url", async () => {
    await createSubscriptionCheckoutSessionAction("/dashboard/courses");

    expect(mockStripeSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url: expect.stringMatching(/\/dashboard\/courses$/),
      })
    );
  });

  it("sanitizes loginUrl callbackUrl for unauthenticated callers", async () => {
    mockUser = null;

    const res = await createSubscriptionCheckoutSessionAction("https://attacker.com");
    expect(res.error).toBe("unauthorized");
    expect(res.loginUrl).toBe("/login?callbackUrl=%2Fbilling");
    expect(res.loginUrl).not.toContain("attacker.com");
  });
});
