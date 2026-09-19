import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedSubscription,
  type TestDb,
} from "../helpers";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

const mockStripeSessionsCreate = vi.fn();
const mockPortalSessionsCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeSessionsCreate(...args),
      },
    },
    billingPortal: {
      sessions: {
        create: (...args: unknown[]) => mockPortalSessionsCreate(...args),
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
        id: "session_sub_123",
        userId: mockUser.id,
      },
    };
  }),
}));

import { createSubscriptionCheckoutSession } from "@/features/subscriptions/checkout";
import {
  createSubscriptionCheckoutSessionAction,
  manageSubscriptionAction,
} from "@/features/subscriptions/actions";

describe("Slice 1 — Subscriptions Checkout Domain & Actions", () => {
  let user: { id: string; email: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "subscriber@example.com" });
    mockUser = user;

    mockStripeSessionsCreate.mockResolvedValue({
      id: "cs_test_sub_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_sub_123",
    });

    mockPortalSessionsCreate.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/portal_123",
    });
  });

  describe("createSubscriptionCheckoutSession", () => {
    it("creates recurring monthly checkout session with 7-day trial and dynamic payment methods", async () => {
      const res = await createSubscriptionCheckoutSession({
        userId: user.id,
        customerEmail: user.email,
        successUrl: "https://example.com/success?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "https://example.com/cancel",
      });

      expect(res.sessionId).toBe("cs_test_sub_123");
      expect(res.url).toBe("https://checkout.stripe.com/c/pay/cs_test_sub_123");

      const [params] = mockStripeSessionsCreate.mock.calls[0];
      expect(params.mode).toBe("subscription");
      expect(params.payment_method_types).toBeUndefined();
      expect(params.subscription_data.trial_period_days).toBe(7);
      expect(params.subscription_data.metadata).toEqual({
        userId: user.id,
        subscriptionType: "all_access",
      });
      expect(params.line_items[0].price_data.unit_amount).toBe(1500);
      expect(params.line_items[0].price_data.recurring.interval).toBe("month");
    });

    it("enforces mutual exclusivity between customer and customer_email", async () => {
      await createSubscriptionCheckoutSession({
        userId: user.id,
        stripeCustomerId: "cus_existing_sub_123",
        customerEmail: user.email,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

      const [params] = mockStripeSessionsCreate.mock.calls[0];
      expect(params.customer).toBe("cus_existing_sub_123");
      expect(params.customer_email).toBeUndefined();
    });
  });

  describe("createSubscriptionCheckoutSessionAction", () => {
    it("redirects to /billing if user already has an active subscription (D6 / Invariant #11)", async () => {
      await seedSubscription(testDb, {
        userId: user.id,
        status: "active",
      });

      const res = await createSubscriptionCheckoutSessionAction();
      expect(res.redirectTo).toBe("/billing");
      expect(mockStripeSessionsCreate).not.toHaveBeenCalled();
    });

    it("redirects to /billing if user already has a trialing subscription", async () => {
      await seedSubscription(testDb, {
        userId: user.id,
        status: "trialing",
      });

      const res = await createSubscriptionCheckoutSessionAction();
      expect(res.redirectTo).toBe("/billing");
      expect(mockStripeSessionsCreate).not.toHaveBeenCalled();
    });

    it("creates checkout session if user has no subscription or only canceled subscription", async () => {
      await seedSubscription(testDb, {
        userId: user.id,
        status: "canceled",
      });

      const res = await createSubscriptionCheckoutSessionAction();
      expect(res.url).toBe("https://checkout.stripe.com/c/pay/cs_test_sub_123");
      expect(mockStripeSessionsCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("manageSubscriptionAction", () => {
    it("returns error if user has no subscription history", async () => {
      const res = await manageSubscriptionAction();
      expect(res.error).toBe("No active or past subscription found to manage");
    });

    it("creates portal session strictly for authenticated user's stripeCustomerId", async () => {
      await seedSubscription(testDb, {
        userId: user.id,
        stripeCustomerId: "cus_user_correct_123",
        status: "active",
      });

      const res = await manageSubscriptionAction();
      expect(res.url).toBe("https://billing.stripe.com/p/session/portal_123");

      const [portalParams] = mockPortalSessionsCreate.mock.calls[0];
      expect(portalParams.customer).toBe("cus_user_correct_123");
      expect(portalParams.return_url).toContain("/billing");
    });
  });
});
