import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLesson,
  seedPurchase,
  seedSubscription,
  seedEntitlement,
  seedLessonProgress,
  type TestDb,
} from "../helpers";
import {
  purchases,
  subscriptions,
  refundTombstones,
  lessonProgress,
} from "@/lib/db/schema";
import { hasAccess } from "@/features/entitlements/access";
import {
  handlePurchaseCheckoutCompleted,
  handlePurchaseRefund,
} from "@/features/purchases/handlers";
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleSubscriptionCheckoutCompleted,
} from "@/features/subscriptions/handlers";
import { dispatchStripeEvent } from "@/features/stripe/dispatch";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
}));

describe("Slice 2 — Stripe Webhook Processing Matrix", () => {
  let user: { id: string; email: string };
  let course: { id: string; slug: string };
  let lesson: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "student@example.com" });
    const creator = await seedUser(testDb, { name: "Author" });
    course = await seedCourse(testDb, {
      creatorId: creator.id,
      priceCents: 4900,
      isPublished: true,
    });
    lesson = await seedLesson(testDb, { courseId: course.id });
  });

  describe("One-Time Purchase Fulfillment & Idempotency", () => {
    it("writes purchase record with pricePaidCents and grants course entitlement in single tx", async () => {
      const session = {
        id: "cs_purchase_001",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_purchase_001",
        amount_total: 4900,
        metadata: {
          userId: user.id,
          courseId: course.id,
        },
      } as unknown as Stripe.Checkout.Session;

      const fulfilled = await handlePurchaseCheckoutCompleted(session, {
        eventId: "evt_purchase_001",
        eventEpoch: 1000,
        eventType: "checkout.session.completed",
      });

      expect(fulfilled).toBe(true);

      const [purchase] = await testDb
        .select()
        .from(purchases)
        .where(eq(purchases.stripeSessionId, "cs_purchase_001"));

      expect(purchase).toBeDefined();
      expect(purchase.userId).toBe(user.id);
      expect(purchase.courseId).toBe(course.id);
      expect(purchase.pricePaidCents).toBe(4900);
      expect(purchase.status).toBe("completed");

      const isEntitled = await hasAccess(user.id, course.id);
      expect(isEntitled).toBe(true);
    });

    it("is idempotent: duplicate event delivery produces no duplicate records", async () => {
      const session = {
        id: "cs_purchase_002",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_purchase_002",
        amount_total: 4900,
        metadata: {
          userId: user.id,
          courseId: course.id,
        },
      } as unknown as Stripe.Checkout.Session;

      const first = await handlePurchaseCheckoutCompleted(session, {
        eventId: "evt_purchase_002",
        eventEpoch: 1000,
        eventType: "checkout.session.completed",
      });
      const second = await handlePurchaseCheckoutCompleted(session, {
        eventId: "evt_purchase_002",
        eventEpoch: 1000,
        eventType: "checkout.session.completed",
      });

      expect(first).toBe(true);
      expect(second).toBe(false);

      const rows = await testDb
        .select()
        .from(purchases)
        .where(eq(purchases.stripeSessionId, "cs_purchase_002"));
      expect(rows).toHaveLength(1);
    });

    it("Invariant #12: prevents duplicate purchase rows if completed purchase already exists", async () => {
      await seedPurchase(testDb, {
        userId: user.id,
        courseId: course.id,
        status: "completed",
      });

      const session = {
        id: "cs_purchase_003",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_purchase_003",
        amount_total: 4900,
        metadata: {
          userId: user.id,
          courseId: course.id,
        },
      } as unknown as Stripe.Checkout.Session;

      const res = await handlePurchaseCheckoutCompleted(session, {
        eventId: "evt_purchase_003",
        eventEpoch: 1000,
        eventType: "checkout.session.completed",
      });

      expect(res).toBe(false);

      const rows = await testDb
        .select()
        .from(purchases)
        .where(and(eq(purchases.userId, user.id), eq(purchases.courseId, course.id)));
      expect(rows).toHaveLength(1);
    });
  });

  describe("Refund Handling & Tombstones (Invariant #6 / D5)", () => {
    it("full refund revokes course entitlement, sets status=refunded, leaves progress untouched", async () => {
      await seedPurchase(testDb, {
        userId: user.id,
        courseId: course.id,
        stripePaymentIntentId: "pi_to_refund_100",
        status: "completed",
      });

      await seedEntitlement(testDb, {
        userId: user.id,
        courseId: course.id,
        source: "purchase",
      });

      await seedLessonProgress(testDb, {
        userId: user.id,
        courseId: course.id,
        lessonId: lesson.id,
        lessonSlug: lesson.slug,
        completed: true,
      });

      const charge = {
        id: "ch_refund_100",
        payment_intent: "pi_to_refund_100",
        refunded: true,
      } as unknown as Stripe.Charge;

      const res = await handlePurchaseRefund(charge, {
        eventId: "evt_refund_100",
        eventEpoch: 2000,
        eventType: "charge.refunded",
      });

      expect(res).toBe(true);

      const [purchase] = await testDb
        .select()
        .from(purchases)
        .where(eq(purchases.stripePaymentIntentId, "pi_to_refund_100"));
      expect(purchase.status).toBe("refunded");

      const isEntitled = await hasAccess(user.id, course.id);
      expect(isEntitled).toBe(false);

      // Invariant #6: Lesson progress must remain untouched
      const progressRows = await testDb
        .select()
        .from(lessonProgress)
        .where(eq(lessonProgress.userId, user.id));
      expect(progressRows).toHaveLength(1);
      expect(progressRows[0].completed).toBe(true);
    });

    it("partial refund retains access (Invariant #6 / D5)", async () => {
      await seedPurchase(testDb, {
        userId: user.id,
        courseId: course.id,
        stripePaymentIntentId: "pi_partial_refund_101",
        status: "completed",
      });

      await seedEntitlement(testDb, {
        userId: user.id,
        courseId: course.id,
        source: "purchase",
      });

      const charge = {
        id: "ch_partial_refund_101",
        payment_intent: "pi_partial_refund_101",
        refunded: false, // partial refund
        amount_refunded: 1000,
      } as unknown as Stripe.Charge;

      const res = await handlePurchaseRefund(charge, {
        eventId: "evt_partial_refund_101",
        eventEpoch: 2000,
        eventType: "charge.refunded",
      });

      expect(res).toBe(false);

      const isEntitled = await hasAccess(user.id, course.id);
      expect(isEntitled).toBe(true);
    });

    it("refund before fulfillment: writes refund tombstone and prevents subsequent checkout completed grant", async () => {
      const charge = {
        id: "ch_pre_refund_102",
        payment_intent: "pi_pre_refund_102",
        refunded: true,
      } as unknown as Stripe.Charge;

      // 1. Refund webhook arrives BEFORE purchase completed webhook
      await handlePurchaseRefund(charge, {
        eventId: "evt_refund_pre_102",
        eventEpoch: 1500,
        eventType: "charge.refunded",
      });

      const [tombstone] = await testDb
        .select()
        .from(refundTombstones)
        .where(eq(refundTombstones.stripePaymentIntentId, "pi_pre_refund_102"));
      expect(tombstone).toBeDefined();

      // 2. Delayed checkout.session.completed arrives
      const session = {
        id: "cs_pre_refund_102",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_pre_refund_102",
        amount_total: 4900,
        metadata: {
          userId: user.id,
          courseId: course.id,
        },
      } as unknown as Stripe.Checkout.Session;

      const fulfilled = await handlePurchaseCheckoutCompleted(session, {
        eventId: "evt_checkout_late_102",
        eventEpoch: 1600,
        eventType: "checkout.session.completed",
      });

      expect(fulfilled).toBe(false);

      // Entitlement must not be granted
      const isEntitled = await hasAccess(user.id, course.id);
      expect(isEntitled).toBe(false);
    });
  });

  describe("Subscription Fulfillment & Lifecycle", () => {
    it("fulfills subscription with payment_status=no_payment_required (7-day trial, Fix 1.2)", async () => {
      const subFixture = {
        id: "sub_trial_001",
        customer: "cus_trial_001",
        status: "trialing",
        trial_end: Math.floor(Date.now() / 1000) + 7 * 86400,
        cancel_at_period_end: false,
        items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
      } as unknown as Stripe.Subscription;

      const session = {
        id: "cs_sub_trial_001",
        mode: "subscription",
        payment_status: "no_payment_required",
        subscription: "sub_trial_001",
        metadata: { userId: user.id },
      } as unknown as Stripe.Checkout.Session;

      const res = await handleSubscriptionCheckoutCompleted(
        session,
        {
          eventId: "evt_sub_trial_001",
          eventEpoch: 3000,
          eventType: "checkout.session.completed",
        },
        subFixture
      );

      expect(res).toBe(true);

      const [sub] = await testDb
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, "sub_trial_001"));
      expect(sub).toBeDefined();
      expect(sub.status).toBe("trialing");
      expect(sub.stripeSessionId).toBe("cs_sub_trial_001");

      // Trial grants global All-Access entitlement (course_id = null)
      const isEntitled = await hasAccess(user.id, course.id);
      expect(isEntitled).toBe(true);
    });

    it("past_due revokes entitlement immediately without grace period (Invariant #5)", async () => {
      await seedSubscription(testDb, {
        userId: user.id,
        stripeSubscriptionId: "sub_past_due_001",
        status: "active",
        lastEventEpoch: 100,
      });

      await seedEntitlement(testDb, {
        userId: user.id,
        courseId: null,
        source: "subscription",
      });

      const subFixture = {
        id: "sub_past_due_001",
        customer: "cus_001",
        status: "past_due",
        metadata: { userId: user.id },
      } as unknown as Stripe.Subscription;

      await handleSubscriptionUpdated(subFixture, {
        eventId: "evt_past_due_001",
        eventEpoch: 200,
        eventType: "customer.subscription.updated",
      });

      const isEntitled = await hasAccess(user.id, course.id);
      expect(isEntitled).toBe(false);
    });

    it("deleted revokes subscription entitlement but leaves standalone purchases intact (Invariant #4)", async () => {
      // 1. User has standalone purchase for course
      await seedPurchase(testDb, {
        userId: user.id,
        courseId: course.id,
        status: "completed",
      });
      await seedEntitlement(testDb, {
        userId: user.id,
        courseId: course.id,
        source: "purchase",
      });

      // 2. User also had All-Access subscription
      await seedSubscription(testDb, {
        userId: user.id,
        stripeSubscriptionId: "sub_to_cancel_001",
        status: "active",
        lastEventEpoch: 100,
      });
      await seedEntitlement(testDb, {
        userId: user.id,
        courseId: null,
        source: "subscription",
      });

      const subFixture = {
        id: "sub_to_cancel_001",
        customer: "cus_001",
        metadata: { userId: user.id },
      } as unknown as Stripe.Subscription;

      await handleSubscriptionDeleted(subFixture, {
        eventId: "evt_deleted_001",
        eventEpoch: 200,
        eventType: "customer.subscription.deleted",
      });

      // Course A was purchased outright, remains accessible!
      const canAccessCourse = await hasAccess(user.id, course.id);
      expect(canAccessCourse).toBe(true);

      // Another unpurchased course is no longer accessible
      const otherCourse = await seedCourse(testDb, { creatorId: user.id, isPublished: true });
      const canAccessOther = await hasAccess(user.id, otherCourse.id);
      expect(canAccessOther).toBe(false);
    });

    it("same-second race protection: subscription.created after updated does not overwrite (Fix 1.4)", async () => {
      // Suppose updated arrived at epoch 500 and set status = 'active'
      const updatedSub = {
        id: "sub_race_001",
        customer: "cus_race_001",
        status: "active",
        metadata: { userId: user.id },
      } as unknown as Stripe.Subscription;

      await handleSubscriptionUpdated(updatedSub, {
        eventId: "evt_updated_500",
        eventEpoch: 500,
        eventType: "customer.subscription.updated",
      });

      // Then created arrives in the SAME second (epoch 500) with status = 'incomplete'
      const createdSub = {
        id: "sub_race_001",
        customer: "cus_race_001",
        status: "incomplete",
        metadata: { userId: user.id },
      } as unknown as Stripe.Subscription;

      const createdRes = await handleSubscriptionCreated(createdSub, {
        eventId: "evt_created_500",
        eventEpoch: 500,
        eventType: "customer.subscription.created",
      });

      expect(createdRes).toBe(false);

      const [row] = await testDb
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, "sub_race_001"));
      expect(row.status).toBe("active");
    });
  });

  describe("Async Payments & Dispatcher Router", () => {
    it("handles checkout.session.async_payment_succeeded for delayed payment methods (D13)", async () => {
      const asyncSession = {
        id: "cs_async_001",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_async_001",
        amount_total: 4900,
        metadata: {
          userId: user.id,
          courseId: course.id,
        },
      };

      const event = {
        id: "evt_async_001",
        type: "checkout.session.async_payment_succeeded",
        created: 4000,
        data: {
          object: asyncSession,
        },
      } as unknown as Stripe.Event;

      const res = await dispatchStripeEvent(event);
      expect(res.handled).toBe(true);

      const isEntitled = await hasAccess(user.id, course.id);
      expect(isEntitled).toBe(true);
    });
  });
});
