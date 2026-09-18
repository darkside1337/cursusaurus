import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLesson,
  type TestDb,
} from "../helpers";
import { purchases, subscriptions } from "@/db/schema";
import { hasAccess } from "@/features/entitlements/access";
import { reconcileCheckoutSession } from "@/features/purchases/reconcile";
import { reconcileSubscriptionSession } from "@/features/subscriptions/reconcile";

let testDb: TestDb;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("Slice 7 — Payment Reconciliation & Recovery (Invariant #10)", () => {
  let user: { id: string };
  let course: { id: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    user = await seedUser(testDb);
    const creator = await seedUser(testDb);
    course = await seedCourse(testDb, { creatorId: creator.id, isPublished: true, priceCents: 4900 });
    await seedLesson(testDb, { courseId: course.id });
  });

  it("heals a simulated missed purchase webhook and grants access", async () => {
    const session = {
      id: "cs_missed_purchase_001",
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_missed_purchase_001",
      amount_total: 4900,
      created: 1000,
      metadata: {
        userId: user.id,
        courseId: course.id,
      },
    } as unknown as Stripe.Checkout.Session;

    const reconciled = await reconcileCheckoutSession(session);
    expect(reconciled).toBe(true);

    const isEntitled = await hasAccess(user.id, course.id);
    expect(isEntitled).toBe(true);

    const [purchase] = await testDb
      .select()
      .from(purchases)
      .where(eq(purchases.stripeSessionId, "cs_missed_purchase_001"));
    expect(purchase).toBeDefined();
    expect(purchase.status).toBe("completed");
    expect(purchase.pricePaidCents).toBe(4900);
  });

  it("heals a simulated missed subscription webhook and grants All-Access trial", async () => {
    const subFixture = {
      id: "sub_reconcile_001",
      customer: "cus_reconcile_001",
      status: "trialing",
      trial_end: Math.floor(Date.now() / 1000) + 7 * 86400,
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
    } as unknown as Stripe.Subscription;

    const session = {
      id: "cs_missed_sub_001",
      mode: "subscription",
      payment_status: "no_payment_required",
      subscription: "sub_reconcile_001",
      created: 1000,
      metadata: {
        userId: user.id,
      },
    } as unknown as Stripe.Checkout.Session;

    const reconciled = await reconcileSubscriptionSession(session, subFixture);
    expect(reconciled).toBe(true);

    const isEntitled = await hasAccess(user.id, course.id);
    expect(isEntitled).toBe(true);

    const [sub] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, "sub_reconcile_001"));
    expect(sub).toBeDefined();
    expect(sub.status).toBe("trialing");
    expect(sub.stripeSessionId).toBe("cs_missed_sub_001");
  });

  it("never grants access for unpaid or abandoned sessions", async () => {
    const unpaidSession = {
      id: "cs_unpaid_001",
      mode: "payment",
      payment_status: "unpaid",
      created: 1000,
      metadata: {
        userId: user.id,
        courseId: course.id,
      },
    } as unknown as Stripe.Checkout.Session;

    const reconciled = await reconcileCheckoutSession(unpaidSession);
    expect(reconciled).toBe(false);

    const isEntitled = await hasAccess(user.id, course.id);
    expect(isEntitled).toBe(false);
  });
});
