import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedSubscription,
  type TestDb,
} from "../helpers";

let testDb: TestDb;

vi.mock("@/lib/db", () => ({
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

import { createSubscriptionCheckoutSession } from "@/features/subscriptions/checkout";
import { createSubscriptionCheckoutSessionAction } from "@/features/subscriptions/actions";

describe("P3-1: Trial Abuse Prevention & Server Price ID Enforcement", () => {
  let user: { id: string; email: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    mockStripeSessionsCreate.mockResolvedValue({
      id: "cs_mock_trial_123",
      url: "https://checkout.stripe.com/c/pay/cs_mock_trial_123",
    });

    user = await seedUser(testDb, { email: "trial-test@example.com" });
    mockUser = user;
  });

  it("first-time subscriber receives 7-day trial", async () => {
    await createSubscriptionCheckoutSessionAction();

    expect(mockStripeSessionsCreate).toHaveBeenCalledTimes(1);
    const createParams = mockStripeSessionsCreate.mock.calls[0][0];

    expect(createParams.subscription_data).toBeDefined();
    expect(createParams.subscription_data.trial_period_days).toBe(7);
  });

  it("returning subscriber with canceled subscription does NOT receive another trial", async () => {
    // Seed a past canceled subscription
    await seedSubscription(testDb, {
      userId: user.id,
      status: "canceled",
      stripeCustomerId: "cus_existing_returning",
    });

    await createSubscriptionCheckoutSessionAction();

    expect(mockStripeSessionsCreate).toHaveBeenCalledTimes(1);
    const createParams = mockStripeSessionsCreate.mock.calls[0][0];

    expect(createParams.subscription_data).toBeDefined();
    expect(createParams.subscription_data.trial_period_days).toBeUndefined();
    // Reuses existing customer ID
    expect(createParams.customer).toBe("cus_existing_returning");
  });

  it("createSubscriptionCheckoutSession omits trial_period_days when hasUsedTrial is true", async () => {
    await createSubscriptionCheckoutSession({
      userId: user.id,
      customerEmail: user.email,
      hasUsedTrial: true,
      successUrl: "http://localhost:3000/checkout/success",
      cancelUrl: "http://localhost:3000/billing",
    });

    const createParams = mockStripeSessionsCreate.mock.calls[0][0];
    expect(createParams.subscription_data.trial_period_days).toBeUndefined();
  });
});
