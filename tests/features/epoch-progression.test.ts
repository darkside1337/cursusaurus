import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedSubscription,
  type TestDb,
} from "../helpers";
import { subscriptions } from "@/lib/db/schema";
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from "@/features/subscriptions/handlers";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("P3-2: Webhook Epoch Progression & Zombie Resurrection Guard", () => {
  let user: { id: string; email: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();
    user = await seedUser(testDb, { email: "epoch-test@example.com" });
  });

  function makeStripeSub(id: string, status: Stripe.Subscription.Status = "active"): Stripe.Subscription {
    const epochNow = 1700000000;
    return {
      id,
      customer: "cus_mock_epoch",
      status,
      current_period_end: epochNow + 30 * 86400,
      cancel_at_period_end: false,
      trial_end: null,
      metadata: {
        userId: user.id,
        subscriptionType: "all_access",
      },
      items: {
        data: [{ current_period_end: epochNow + 30 * 86400 }],
      },
    } as unknown as Stripe.Subscription;
  }

  it("permits same-second created -> updated event progression", async () => {
    const subId = "sub_same_second_1";
    const sameEpoch = 1710000000;

    // 1. created event at sameEpoch
    const createdSuccess = await handleSubscriptionCreated(
      makeStripeSub(subId, "trialing"),
      {
        eventId: "evt_created_same_second",
        eventType: "customer.subscription.created",
        eventEpoch: sameEpoch,
      }
    );
    expect(createdSuccess).toBe(true);

    const [createdSub] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(createdSub?.status).toBe("trialing");
    expect(Number(createdSub?.lastEventEpoch)).toBe(sameEpoch);

    // 2. updated event at EXACT same second (epoch)
    const updatedSuccess = await handleSubscriptionUpdated(
      makeStripeSub(subId, "active"),
      {
        eventId: "evt_updated_same_second",
        eventType: "customer.subscription.updated",
        eventEpoch: sameEpoch,
      }
    );
    expect(updatedSuccess).toBe(true);

    const [updatedSub] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(updatedSub?.status).toBe("active");
  });

  it("rejects out-of-order stale update when eventEpoch < lastEventEpoch", async () => {
    const subId = "sub_stale_1";
    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "active",
      lastEventEpoch: 1710000500,
    });

    const success = await handleSubscriptionUpdated(
      makeStripeSub(subId, "active"),
      {
        eventId: "evt_stale_update",
        eventType: "customer.subscription.updated",
        eventEpoch: 1710000499, // 1 second older
      }
    );

    expect(success).toBe(false);
  });

  it("blocks zombie resurrection of canceled subscriptions on same-second (<=) update", async () => {
    const subId = "sub_canceled_1";
    const cancelEpoch = 1710001000;

    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "canceled",
      lastEventEpoch: cancelEpoch,
    });

    // 1. Same-second update arrives after cancellation
    const sameSecondSuccess = await handleSubscriptionUpdated(
      makeStripeSub(subId, "active"),
      {
        eventId: "evt_same_second_resurrection",
        eventType: "customer.subscription.updated",
        eventEpoch: cancelEpoch,
      }
    );
    expect(sameSecondSuccess).toBe(false);

    // 2. Stale update arrives after cancellation
    const olderSuccess = await handleSubscriptionUpdated(
      makeStripeSub(subId, "active"),
      {
        eventId: "evt_older_resurrection",
        eventType: "customer.subscription.updated",
        eventEpoch: cancelEpoch - 10,
      }
    );
    expect(olderSuccess).toBe(false);

    // Verify DB row remains canceled
    const [sub] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(sub?.status).toBe("canceled");
  });

  it("blocks zombie resurrection in handleSubscriptionDeleted if already canceled at same epoch", async () => {
    const subId = "sub_canceled_del_1";
    const cancelEpoch = 1710002000;

    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "canceled",
      lastEventEpoch: cancelEpoch,
    });

    const res = await handleSubscriptionDeleted(
      makeStripeSub(subId, "canceled"),
      {
        eventId: "evt_same_second_del",
        eventType: "customer.subscription.deleted",
        eventEpoch: cancelEpoch,
      }
    );
    expect(res).toBe(false);
  });
});
