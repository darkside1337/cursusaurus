import { test, expect } from "@playwright/test";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { purchases, entitlements, processedStripeEvents, subscriptions } from "@/lib/db/schema";
import { createIsolatedUser, createIsolatedCourse } from "./helpers/test-isolation";
import { createStripeEventPayload, postWebhookEvent } from "./helpers/stripe-test-harness";

test.describe("Spec 08: Webhook Concurrency & Idempotency Under Real Postgres", () => {
  test("10 concurrent identical checkout events result in exactly 1 purchase and 1 entitlement", async ({ baseURL }) => {
    const creator = await createIsolatedUser("creator", "ConcurrencyCreator");
    const learner = await createIsolatedUser("learner", "ConcurrencyLearner");
    const course = await createIsolatedCourse(creator.id);

    const eventId = `evt_conc_${crypto.randomUUID().slice(0, 10)}`;
    const sessionId = `cs_conc_${crypto.randomUUID().slice(0, 10)}`;
    const paymentIntentId = `pi_conc_${crypto.randomUUID().slice(0, 10)}`;

    const eventPayload = createStripeEventPayload(
      "checkout.session.completed",
      {
        id: sessionId,
        mode: "payment",
        payment_status: "paid",
        amount_total: 4900,
        payment_intent: paymentIntentId,
        metadata: {
          userId: learner.id,
          courseId: course.id,
        },
      },
      { eventId }
    );

    // Fire 10 concurrent requests at the exact same moment
    const promises = Array.from({ length: 10 }).map(() =>
      postWebhookEvent(eventPayload, { baseUrl: baseURL })
    );

    const responses = await Promise.all(promises);

    // Assert all 10 requests were handled successfully (HTTP 200)
    for (const res of responses) {
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
    }

    // Verify DB state: exactly 1 purchase row
    const purchaseRows = await db
      .select()
      .from(purchases)
      .where(eq(purchases.stripeSessionId, sessionId));
    expect(purchaseRows.length).toBe(1);
    expect(purchaseRows[0].status).toBe("completed");

    // Verify DB state: exactly 1 active entitlement
    const entitlementRows = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, learner.id),
          eq(entitlements.courseId, course.id),
          isNull(entitlements.revokedAt)
        )
      );
    expect(entitlementRows.length).toBe(1);
    expect(entitlementRows[0].source).toBe("purchase");

    // Verify DB state: exactly 1 processed event entry for this eventId
    const eventRows = await db
      .select()
      .from(processedStripeEvents)
      .where(eq(processedStripeEvents.eventId, eventId));
    expect(eventRows.length).toBe(1);
  });

  test("same checkout session arriving under two distinct event IDs is absorbed without duplicate grant", async ({ baseURL }) => {
    const creator = await createIsolatedUser("creator", "DistinctEvtCreator");
    const learner = await createIsolatedUser("learner", "DistinctEvtLearner");
    const course = await createIsolatedCourse(creator.id);

    const sessionId = `cs_distinct_${crypto.randomUUID().slice(0, 10)}`;
    const paymentIntentId = `pi_distinct_${crypto.randomUUID().slice(0, 10)}`;
    const eventId1 = `evt_distinct_1_${crypto.randomUUID().slice(0, 8)}`;
    const eventId2 = `evt_distinct_2_${crypto.randomUUID().slice(0, 8)}`;

    const eventPayload1 = createStripeEventPayload(
      "checkout.session.completed",
      {
        id: sessionId,
        mode: "payment",
        payment_status: "paid",
        amount_total: 4900,
        payment_intent: paymentIntentId,
        metadata: {
          userId: learner.id,
          courseId: course.id,
        },
      },
      { eventId: eventId1 }
    );

    const eventPayload2 = createStripeEventPayload(
      "checkout.session.completed",
      {
        id: sessionId,
        mode: "payment",
        payment_status: "paid",
        amount_total: 4900,
        payment_intent: paymentIntentId,
        metadata: {
          userId: learner.id,
          courseId: course.id,
        },
      },
      { eventId: eventId2 }
    );

    // Fire both events concurrently
    const [res1, res2] = await Promise.all([
      postWebhookEvent(eventPayload1, { baseUrl: baseURL }),
      postWebhookEvent(eventPayload2, { baseUrl: baseURL }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Verify subsequent retry of Event 2 also returns 200
    const retryRes = await postWebhookEvent(eventPayload2, { baseUrl: baseURL });
    expect(retryRes.status).toBe(200);

    // Verify DB state: exactly 1 purchase row and 1 entitlement
    const purchaseRows = await db
      .select()
      .from(purchases)
      .where(eq(purchases.stripeSessionId, sessionId));
    expect(purchaseRows.length).toBe(1);

    const entitlementRows = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, learner.id),
          eq(entitlements.courseId, course.id),
          isNull(entitlements.revokedAt)
        )
      );
    expect(entitlementRows.length).toBe(1);
  });

  test("deterministic out-of-order subscription progression respects epoch guard", async ({ baseURL }) => {
    const subscriber = await createIsolatedUser("learner", "OutOfOrderSubscriber");
    const subId = `sub_ooo_${crypto.randomUUID().slice(0, 10)}`;
    const custId = `cus_ooo_${crypto.randomUUID().slice(0, 10)}`;

    const currentEpoch = Math.floor(Date.now() / 1000);
    const newerEpoch = currentEpoch + 500; // e.g. T+500
    const olderEpoch = currentEpoch + 100; // e.g. T+100

    // 1. Initial creation (status: trialing)
    const createPayload = createStripeEventPayload(
      "customer.subscription.created",
      {
        id: subId,
        customer: custId,
        status: "trialing",
        trial_end: currentEpoch + 7 * 86400,
        metadata: { userId: subscriber.id },
      },
      { createdEpoch: currentEpoch }
    );
    const createRes = await postWebhookEvent(createPayload, { baseUrl: baseURL });
    expect(createRes.status).toBe(200);

    // Verify entitlement granted
    const [initialEntitlement] = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, subscriber.id),
          isNull(entitlements.courseId),
          isNull(entitlements.revokedAt)
        )
      );
    expect(initialEntitlement).toBeDefined();

    // 2. Send NEWER event first: status = "canceled" at newerEpoch
    const newerPayload = createStripeEventPayload(
      "customer.subscription.deleted",
      {
        id: subId,
        customer: custId,
        status: "canceled",
        metadata: { userId: subscriber.id },
      },
      { createdEpoch: newerEpoch }
    );
    const newerRes = await postWebhookEvent(newerPayload, { baseUrl: baseURL });
    expect(newerRes.status).toBe(200);

    // Verify status canceled and entitlement revoked
    const [canceledSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(canceledSub.status).toBe("canceled");

    const [activeEntitlementAfterCancel] = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, subscriber.id),
          isNull(entitlements.courseId),
          isNull(entitlements.revokedAt)
        )
      );
    expect(activeEntitlementAfterCancel).toBeUndefined();

    // 3. Send OLDER event second: status = "active" at olderEpoch
    const olderPayload = createStripeEventPayload(
      "customer.subscription.updated",
      {
        id: subId,
        customer: custId,
        status: "active",
        metadata: { userId: subscriber.id },
      },
      { createdEpoch: olderEpoch }
    );
    const olderRes = await postWebhookEvent(olderPayload, { baseUrl: baseURL });
    expect(olderRes.status).toBe(200);

    // Epoch guard must reject resurrecting the subscription
    const [finalSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(finalSub.status).toBe("canceled");

    // Entitlement must remain revoked (no zombie revival)
    const [finalActiveEntitlement] = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, subscriber.id),
          isNull(entitlements.courseId),
          isNull(entitlements.revokedAt)
        )
      );
    expect(finalActiveEntitlement).toBeUndefined();
  });
});
