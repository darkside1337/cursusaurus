import { test, expect } from "@playwright/test";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { purchases, entitlements, lessonProgress } from "@/lib/db/schema";
import { hasAccess } from "@/features/entitlements/access";
import { createIsolatedUser, createIsolatedCourse } from "./helpers/test-isolation";
import { createStripeEventPayload, postWebhookEvent } from "./helpers/stripe-test-harness";

test.describe("Spec 05: Payments & Entitlements Lifecycle Matrix", () => {
  test("Scenario A: One-time purchase fulfillment and checkout success polling", async ({
    page,
    context,
    baseURL,
  }) => {
    const creator = await createIsolatedUser("creator", "OTPCreator");
    const learner = await createIsolatedUser("learner", "OTPLearner");
    const course = await createIsolatedCourse(creator.id);
    await context.addCookies(learner.cookies);

    const sessionId = `cs_otp_${crypto.randomUUID().slice(0, 10)}`;
    const paymentIntentId = `pi_otp_${crypto.randomUUID().slice(0, 10)}`;

    // Dispatch webhook for completed payment
    const eventPayload = createStripeEventPayload("checkout.session.completed", {
      id: sessionId,
      mode: "payment",
      payment_status: "paid",
      amount_total: 4900,
      payment_intent: paymentIntentId,
      metadata: {
        userId: learner.id,
        courseId: course.id,
      },
    });

    const res = await postWebhookEvent(eventPayload, { baseUrl: baseURL });
    expect(res.status).toBe(200);

    // Verify order status endpoint confirms fulfillment
    const statusRes = await page.request.get(`/api/order-status/${sessionId}`);
    expect(statusRes.status()).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.status).toBe("completed");

    // Verify hasAccess() returns true
    const access = await hasAccess(learner.id, course.id);
    expect(access).toBe(true);

    // Navigate to checkout success page and verify confirmed state renders
    await page.goto(`/checkout/success?session_id=${sessionId}`);
    await expect(page.locator("body")).toContainText("Entitlement Confirmed");
    await expect(page.locator("body")).toContainText(course.title);
  });

  test("Scenario B: All-Access subscription free trial grants all-access entitlement", async ({
    context,
    baseURL,
  }) => {
    const creator = await createIsolatedUser("creator", "SubTrialCreator");
    const subscriber = await createIsolatedUser("learner", "SubTrialLearner");
    const course = await createIsolatedCourse(creator.id);
    await context.addCookies(subscriber.cookies);

    const subId = `sub_trial_${crypto.randomUUID().slice(0, 10)}`;
    const custId = `cus_trial_${crypto.randomUUID().slice(0, 10)}`;

    const eventPayload = createStripeEventPayload("customer.subscription.created", {
      id: subId,
      customer: custId,
      status: "trialing",
      trial_end: Math.floor(Date.now() / 1000) + 7 * 86400,
      metadata: {
        userId: subscriber.id,
      },
    });

    const res = await postWebhookEvent(eventPayload, { baseUrl: baseURL });
    expect(res.status).toBe(200);

    // Verify all-access entitlement exists (courseId = null)
    const [subEntitlement] = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, subscriber.id),
          isNull(entitlements.courseId),
          isNull(entitlements.revokedAt)
        )
      );
    expect(subEntitlement).toBeDefined();
    expect(subEntitlement.source).toBe("subscription");

    // Access to any course is granted
    const access = await hasAccess(subscriber.id, course.id);
    expect(access).toBe(true);
  });

  test("Scenario C: Dual entitlement renders 'Purchased' badge and preserves purchase on subscription cancellation", async ({
    page,
    context,
    baseURL,
  }) => {
    const creator = await createIsolatedUser("creator", "DualCreator");
    const user = await createIsolatedUser("learner", "DualUser");
    const course = await createIsolatedCourse(creator.id);
    await context.addCookies(user.cookies);

    // 1. Grant course purchase
    await db.insert(entitlements).values({
      id: crypto.randomUUID(),
      userId: user.id,
      courseId: course.id,
      source: "purchase",
    });

    // 2. Grant All-Access subscription
    const subId = `sub_dual_${crypto.randomUUID().slice(0, 10)}`;
    const custId = `cus_dual_${crypto.randomUUID().slice(0, 10)}`;
    await postWebhookEvent(
      createStripeEventPayload("customer.subscription.created", {
        id: subId,
        customer: custId,
        status: "active",
        metadata: { userId: user.id },
      }),
      { baseUrl: baseURL }
    );

    // 3. Verify in library: dual-entitlement precedence displays "Purchased"
    await page.goto("/library");
    await expect(page.locator("body")).toContainText(course.title);
    // Find the access badge for this course and assert "Purchased" (precedence over All-Access)
    await expect(page.locator("body")).toContainText("Purchased");

    // 4. Cancel All-Access subscription
    await postWebhookEvent(
      createStripeEventPayload("customer.subscription.deleted", {
        id: subId,
        customer: custId,
        status: "canceled",
        metadata: { userId: user.id },
      }),
      { baseUrl: baseURL }
    );

    // 5. Verify All-Access is revoked, but purchase entitlement stays active
    const activeSubEntitlements = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, user.id),
          isNull(entitlements.courseId),
          isNull(entitlements.revokedAt)
        )
      );
    expect(activeSubEntitlements.length).toBe(0);

    const activePurchaseEntitlements = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, user.id),
          eq(entitlements.courseId, course.id),
          isNull(entitlements.revokedAt)
        )
      );
    expect(activePurchaseEntitlements.length).toBe(1);

    // Learner still has access
    expect(await hasAccess(user.id, course.id)).toBe(true);

    // Reload library and assert course still displays as "Purchased"
    await page.goto("/library");
    await expect(page.locator("body")).toContainText(course.title);
    await expect(page.locator("body")).toContainText("Purchased");
  });

  test("Scenario D: Refunding a subscription invoice charge does not touch purchase or subscription entitlements", async ({
    baseURL,
  }) => {
    const creator = await createIsolatedUser("creator", "SubRefundCreator");
    const user = await createIsolatedUser("learner", "SubRefundUser");
    const course = await createIsolatedCourse(creator.id);

    // 1. Grant purchase entitlement
    await db.insert(entitlements).values({
      id: crypto.randomUUID(),
      userId: user.id,
      courseId: course.id,
      source: "purchase",
    });

    // 2. Grant subscription entitlement
    const subId = `sub_ref_${crypto.randomUUID().slice(0, 10)}`;
    const custId = `cus_ref_${crypto.randomUUID().slice(0, 10)}`;
    await postWebhookEvent(
      createStripeEventPayload("customer.subscription.created", {
        id: subId,
        customer: custId,
        status: "active",
        metadata: { userId: user.id },
      }),
      { baseUrl: baseURL }
    );

    // 3. Send charge.refunded for a subscription payment intent (not in purchases table)
    const subPaymentIntent = `pi_sub_invoice_${crypto.randomUUID().slice(0, 10)}`;
    const refundRes = await postWebhookEvent(
      createStripeEventPayload("charge.refunded", {
        id: `ch_sub_${crypto.randomUUID().slice(0, 10)}`,
        payment_intent: subPaymentIntent,
        refunded: true,
        amount: 1500,
        amount_refunded: 1500,
      }),
      { baseUrl: baseURL }
    );
    expect(refundRes.status).toBe(200);

    // 4. Verify both entitlements remain completely active
    const activeEntitlements = await db
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.userId, user.id), isNull(entitlements.revokedAt)));
    expect(activeEntitlements.length).toBe(2);
  });

  test("Scenario E: Partial refunds retain access until summing to 100% full refund", async ({
    baseURL,
  }) => {
    const creator = await createIsolatedUser("creator", "PartialRefundCreator");
    const learner = await createIsolatedUser("learner", "PartialRefundLearner");
    const course = await createIsolatedCourse(creator.id);

    const paymentIntentId = `pi_part_${crypto.randomUUID().slice(0, 10)}`;
    const sessionId = `cs_part_${crypto.randomUUID().slice(0, 10)}`;

    // Create purchase and entitlement
    await db.insert(purchases).values({
      id: crypto.randomUUID(),
      userId: learner.id,
      courseId: course.id,
      stripePaymentIntentId: paymentIntentId,
      stripeSessionId: sessionId,
      pricePaidCents: 4900,
      status: "completed",
    });

    await db.insert(entitlements).values({
      id: crypto.randomUUID(),
      userId: learner.id,
      courseId: course.id,
      source: "purchase",
    });

    // Create lesson progress row
    await db.insert(lessonProgress).values({
      id: crypto.randomUUID(),
      userId: learner.id,
      courseId: course.id,
      lessonId: course.lessons[0].id,
      completed: true,
      lastPositionSeconds: 150,
    });

    // Step 1: First partial refund ($20 of $49 -> refunded: false)
    const partial1Res = await postWebhookEvent(
      createStripeEventPayload("charge.refunded", {
        id: `ch_part1_${crypto.randomUUID().slice(0, 8)}`,
        payment_intent: paymentIntentId,
        refunded: false,
        amount: 4900,
        amount_refunded: 2000,
      }),
      { baseUrl: baseURL }
    );
    expect(partial1Res.status).toBe(200);

    // Access must remain active
    expect(await hasAccess(learner.id, course.id)).toBe(true);

    // Step 2: Second partial refund ($29 of $49 -> total 100% refunded -> refunded: true)
    const partial2Res = await postWebhookEvent(
      createStripeEventPayload("charge.refunded", {
        id: `ch_part2_${crypto.randomUUID().slice(0, 8)}`,
        payment_intent: paymentIntentId,
        refunded: true,
        amount: 4900,
        amount_refunded: 4900,
      }),
      { baseUrl: baseURL }
    );
    expect(partial2Res.status).toBe(200);

    // Access must now be revoked
    expect(await hasAccess(learner.id, course.id)).toBe(false);

    // Invariant #10: lesson_progress row remains intact
    const [progress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, learner.id),
          eq(lessonProgress.lessonId, course.lessons[0].id)
        )
      );
    expect(progress).toBeDefined();
    expect(progress.completed).toBe(true);
  });

  test("Scenario F: Subscription status matrix (Option A - Strict) and recovery", async ({
    baseURL,
  }) => {
    const subscriber = await createIsolatedUser("learner", "MatrixSubscriber");
    const subId = `sub_mtx_${crypto.randomUUID().slice(0, 10)}`;
    const custId = `cus_mtx_${crypto.randomUUID().slice(0, 10)}`;

    const statuses = [
      { status: "trialing", shouldHaveAccess: true },
      { status: "active", shouldHaveAccess: true },
      { status: "past_due", shouldHaveAccess: false },
      { status: "active", shouldHaveAccess: true }, // recovery
      { status: "unpaid", shouldHaveAccess: false },
      { status: "canceled", shouldHaveAccess: false },
    ];

    let epoch = Math.floor(Date.now() / 1000);

    for (const step of statuses) {
      epoch += 10;
      const res = await postWebhookEvent(
        createStripeEventPayload(
          "customer.subscription.updated",
          {
            id: subId,
            customer: custId,
            status: step.status,
            metadata: { userId: subscriber.id },
          },
          { createdEpoch: epoch }
        ),
        { baseUrl: baseURL }
      );
      expect(res.status).toBe(200);

      const [activeEntitlement] = await db
        .select()
        .from(entitlements)
        .where(
          and(
            eq(entitlements.userId, subscriber.id),
            isNull(entitlements.courseId),
            isNull(entitlements.revokedAt)
          )
        );

      if (step.shouldHaveAccess) {
        expect(activeEntitlement).toBeDefined();
      } else {
        expect(activeEntitlement).toBeUndefined();
      }
    }
  });

  test("Scenario G: cancel_at_period_end preserves access until period end", async ({
    baseURL,
  }) => {
    const subscriber = await createIsolatedUser("learner", "PeriodEndSubscriber");
    const subId = `sub_pe_${crypto.randomUUID().slice(0, 10)}`;
    const custId = `cus_pe_${crypto.randomUUID().slice(0, 10)}`;

    let epoch = Math.floor(Date.now() / 1000);

    // 1. Subscription active with cancel_at_period_end = true
    await postWebhookEvent(
      createStripeEventPayload(
        "customer.subscription.updated",
        {
          id: subId,
          customer: custId,
          status: "active",
          cancel_at_period_end: true,
          current_period_end: epoch + 86400,
          metadata: { userId: subscriber.id },
        },
        { createdEpoch: epoch }
      ),
      { baseUrl: baseURL }
    );

    // Entitlement must remain active
    let [entitlement] = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, subscriber.id),
          isNull(entitlements.courseId),
          isNull(entitlements.revokedAt)
        )
      );
    expect(entitlement).toBeDefined();

    // 2. Period ends -> customer.subscription.deleted arrives
    epoch += 100;
    await postWebhookEvent(
      createStripeEventPayload(
        "customer.subscription.deleted",
        {
          id: subId,
          customer: custId,
          status: "canceled",
          metadata: { userId: subscriber.id },
        },
        { createdEpoch: epoch }
      ),
      { baseUrl: baseURL }
    );

    // Entitlement must now be revoked
    [entitlement] = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, subscriber.id),
          isNull(entitlements.courseId),
          isNull(entitlements.revokedAt)
        )
      );
    expect(entitlement).toBeUndefined();
  });
});
