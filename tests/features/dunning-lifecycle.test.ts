import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type Stripe from "stripe";
import { eq, and, isNull } from "drizzle-orm";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedSubscription,
  seedEntitlement,
  type TestDb,
} from "../helpers";
import { subscriptions, entitlements, processedStripeEvents } from "@/lib/db/schema";
import { hasAccess, hasAllAccess } from "@/features/entitlements/access";
import { handleInvoiceEvent } from "@/features/subscriptions/handlers";
import { dispatchStripeEvent } from "@/features/stripe/dispatch";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

const mockStripeSubscriptionsRetrieve = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      retrieve: (...args: unknown[]) => mockStripeSubscriptionsRetrieve(...args),
    },
  },
}));

describe("Slice 3 — Dunning Lifecycle & Thin Invoice Path", () => {
  let user: { id: string; email: string };
  let course: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "learner@example.com" });
    const creator = await seedUser(testDb, { email: "creator@example.com" });
    course = await seedCourse(testDb, {
      creatorId: creator.id,
      title: "Monograph 1",
      slug: "monograph-1",
      isPublished: true,
    });
  });

  it("invoice.payment_failed transitions subscription to past_due and immediately revokes all-access entitlement", async () => {
    const subId = "sub_dunning_1";
    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "active",
      lastEventEpoch: 1000,
    });
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    expect(await hasAllAccess(user.id)).toBe(true);

    const invoice = {
      id: "in_fail_1",
      subscription: subId,
    } as unknown as Stripe.Invoice;

    const authoritativeSub = {
      id: subId,
      status: "past_due",
      customer: "cus_123",
      items: { data: [{ current_period_end: 2000 }] },
      metadata: { userId: user.id },
    } as unknown as Stripe.Subscription;

    mockStripeSubscriptionsRetrieve.mockResolvedValue(authoritativeSub);

    const handled = await handleInvoiceEvent(
      invoice,
      {
        eventId: "evt_invoice_failed_1",
        eventEpoch: 1100,
        eventType: "invoice.payment_failed",
      }
    );

    expect(handled).toBe(true);

    // Assert subscription is past_due
    const [sub] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(sub?.status).toBe("past_due");
    expect(sub?.lastEventEpoch).toBe(1100);

    // Assert all-access entitlement is immediately revoked
    expect(await hasAllAccess(user.id)).toBe(false);
    const [ent] = await testDb
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.userId, user.id), isNull(entitlements.courseId)));
    expect(ent?.revokedAt).not.toBeNull();
  });

  it("invoice.payment_succeeded on past_due subscription recovers active status and re-grants all-access entitlement", async () => {
    const subId = "sub_dunning_2";
    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "past_due",
      lastEventEpoch: 1100,
    });
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: new Date(),
    });

    expect(await hasAllAccess(user.id)).toBe(false);

    const invoice = {
      id: "in_success_1",
      subscription: subId,
    } as unknown as Stripe.Invoice;

    const authoritativeSub = {
      id: subId,
      status: "active",
      customer: "cus_123",
      items: { data: [{ current_period_end: 3000 }] },
      metadata: { userId: user.id },
    } as unknown as Stripe.Subscription;

    mockStripeSubscriptionsRetrieve.mockResolvedValue(authoritativeSub);

    const handled = await handleInvoiceEvent(
      invoice,
      {
        eventId: "evt_invoice_success_1",
        eventEpoch: 1200,
        eventType: "invoice.payment_succeeded",
      }
    );

    expect(handled).toBe(true);

    // Subscription status recovered to active
    const [sub] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(sub?.status).toBe("active");
    expect(sub?.lastEventEpoch).toBe(1200);

    // All-access entitlement is restored
    expect(await hasAllAccess(user.id)).toBe(true);
  });

  it("handles modern nested subscription object shape: invoice.parent.subscription_details.subscription", async () => {
    const subId = "sub_modern_shape";
    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "active",
      lastEventEpoch: 1000,
    });

    const invoice = {
      id: "in_modern_1",
      subscription: null,
      parent: {
        subscription_details: {
          subscription: subId,
        },
      },
    } as unknown as Stripe.Invoice;

    const authoritativeSub = {
      id: subId,
      status: "past_due",
      customer: "cus_123",
      items: { data: [{ current_period_end: 2000 }] },
      metadata: { userId: user.id },
    } as unknown as Stripe.Subscription;

    mockStripeSubscriptionsRetrieve.mockResolvedValue(authoritativeSub);

    const handled = await handleInvoiceEvent(
      invoice,
      {
        eventId: "evt_modern_invoice_1",
        eventEpoch: 1100,
        eventType: "invoice.payment_failed",
      }
    );

    expect(handled).toBe(true);
    expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith(subId);

    const [sub] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(sub?.status).toBe("past_due");
  });

  it("handles legacy subscription object shape: invoice.subscription as expanded object", async () => {
    const subId = "sub_legacy_shape";
    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "active",
      lastEventEpoch: 1000,
    });

    const invoice = {
      id: "in_legacy_1",
      subscription: { id: subId },
    } as unknown as Stripe.Invoice;

    const authoritativeSub = {
      id: subId,
      status: "past_due",
      customer: "cus_123",
      items: { data: [{ current_period_end: 2000 }] },
      metadata: { userId: user.id },
    } as unknown as Stripe.Subscription;

    mockStripeSubscriptionsRetrieve.mockResolvedValue(authoritativeSub);

    const handled = await handleInvoiceEvent(
      invoice,
      {
        eventId: "evt_legacy_invoice_1",
        eventEpoch: 1100,
        eventType: "invoice.payment_failed",
      }
    );

    expect(handled).toBe(true);
    expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith(subId);
  });

  it("rejects stale out-of-order invoice event via epoch guard", async () => {
    const subId = "sub_stale_invoice";
    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "past_due",
      lastEventEpoch: 1500,
    });

    const invoice = {
      id: "in_stale_1",
      subscription: subId,
    } as unknown as Stripe.Invoice;

    const authoritativeSub = {
      id: subId,
      status: "active",
      customer: "cus_123",
      items: { data: [{ current_period_end: 2000 }] },
      metadata: { userId: user.id },
    } as unknown as Stripe.Subscription;

    mockStripeSubscriptionsRetrieve.mockResolvedValue(authoritativeSub);

    // Deliver invoice event with eventEpoch 1200 < existing 1500
    const handled = await handleInvoiceEvent(
      invoice,
      {
        eventId: "evt_stale_invoice_1",
        eventEpoch: 1200,
        eventType: "invoice.payment_succeeded",
      }
    );

    expect(handled).toBe(false);

    // Subscription status remains unchanged as past_due
    const [sub] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    expect(sub?.status).toBe("past_due");
    expect(sub?.lastEventEpoch).toBe(1500);
  });

  it("preserves standalone purchase entitlements when subscription enters past_due (Invariant #4)", async () => {
    const subId = "sub_dual_entitlement";
    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "active",
      lastEventEpoch: 1000,
    });
    // Active subscription entitlement
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });
    // Active purchase entitlement
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: course.id,
      source: "purchase",
      revokedAt: null,
    });

    expect(await hasAccess(user.id, course.id)).toBe(true);

    const invoice = {
      id: "in_dual_1",
      subscription: subId,
    } as unknown as Stripe.Invoice;

    const authoritativeSub = {
      id: subId,
      status: "past_due",
      customer: "cus_123",
      items: { data: [{ current_period_end: 2000 }] },
      metadata: { userId: user.id },
    } as unknown as Stripe.Subscription;

    mockStripeSubscriptionsRetrieve.mockResolvedValue(authoritativeSub);

    await handleInvoiceEvent(
      invoice,
      {
        eventId: "evt_dual_1",
        eventEpoch: 1100,
        eventType: "invoice.payment_failed",
      }
    );

    // All-access is revoked
    expect(await hasAllAccess(user.id)).toBe(false);

    // But standalone course purchase remains fully active (Invariant #4)
    expect(await hasAccess(user.id, course.id)).toBe(true);
    const [purchaseEnt] = await testDb
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.userId, user.id), eq(entitlements.courseId, course.id)));
    expect(purchaseEnt?.revokedAt).toBeNull();
  });

  it("enforces webhook idempotency on duplicate invoice events via processedStripeEvents", async () => {
    const subId = "sub_idempotent_invoice";
    await seedSubscription(testDb, {
      userId: user.id,
      stripeSubscriptionId: subId,
      status: "active",
      lastEventEpoch: 1000,
    });

    const invoice = {
      id: "in_dup_1",
      subscription: subId,
    } as unknown as Stripe.Invoice;

    const authoritativeSub = {
      id: subId,
      status: "past_due",
      customer: "cus_123",
      items: { data: [{ current_period_end: 2000 }] },
      metadata: { userId: user.id },
    } as unknown as Stripe.Subscription;

    mockStripeSubscriptionsRetrieve.mockResolvedValue(authoritativeSub);

    const event = {
      id: "evt_dup_invoice_1",
      type: "invoice.payment_failed",
      created: 1100,
      data: { object: invoice },
    } as unknown as Stripe.Event;

    // First dispatch
    const result1 = await dispatchStripeEvent(event);
    expect(result1.handled).toBe(true);

    // Second dispatch with identical eventId
    const result2 = await dispatchStripeEvent(event);
    // Should be handled gracefully without reprocessing
    expect(result2.handled).toBe(true);

    // Exactly one row in processedStripeEvents
    const processed = await testDb
      .select()
      .from(processedStripeEvents)
      .where(eq(processedStripeEvents.eventId, "evt_dup_invoice_1"));
    expect(processed.length).toBe(1);
  });
});
