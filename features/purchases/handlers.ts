import type Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { purchases, entitlements, refundTombstones } from "@/lib/db/schema";
import { revokePurchaseEntitlement } from "@/features/entitlements/writers";
import { isEventAlreadyProcessed, recordProcessedEvent } from "@/features/stripe/idempotency";
import type { FulfillmentContext } from "@/features/stripe/types";

/**
 * Handles checkout.session.completed (and async_payment_succeeded) for one-time course purchases.
 * Writes purchase record + course-scoped entitlement in a single transaction (Invariant #8).
 * Ensures idempotency via processed_stripe_events (Invariant #7).
 */
export async function handlePurchaseCheckoutCompleted(
  session: Stripe.Checkout.Session,
  ctx: FulfillmentContext
): Promise<boolean> {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return false;
  }

  const userId = session.metadata?.userId || session.client_reference_id;
  const courseId = session.metadata?.courseId;

  if (!userId || !courseId) {
    throw new Error("Missing userId or courseId in checkout session metadata");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || session.id;

  return await db.transaction(async (tx) => {
    // 1. Check idempotency
    if (await isEventAlreadyProcessed(tx, ctx.eventId)) {
      return false; // Already handled
    }

    // 2. Check for pre-fulfillment refund tombstone (Fix 8)
    const [tombstone] = await tx
      .select({ stripePaymentIntentId: refundTombstones.stripePaymentIntentId })
      .from(refundTombstones)
      .where(eq(refundTombstones.stripePaymentIntentId, paymentIntentId))
      .limit(1);

    if (tombstone) {
      // Payment was already refunded before checkout session completed
      await recordProcessedEvent(tx, ctx);
      return false;
    }

    // 3. Invariant #12 guard: Check if completed purchase already exists
    const [existingCompletedPurchase] = await tx
      .select({ id: purchases.id })
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, userId),
          eq(purchases.courseId, courseId),
          eq(purchases.status, "completed")
        )
      )
      .limit(1);

    if (existingCompletedPurchase) {
      // Acknowledge no-op; record event idempotency
      await recordProcessedEvent(tx, ctx);
      return false;
    }

    await recordProcessedEvent(tx, ctx);

    // 4. Insert purchase record with historical price paid (on conflict do nothing for concurrent arrivals)
    const purchaseId = crypto.randomUUID();
    const insertedPurchases = await tx
      .insert(purchases)
      .values({
        id: purchaseId,
        userId,
        courseId,
        stripePaymentIntentId: paymentIntentId,
        stripeSessionId: session.id,
        pricePaidCents: session.amount_total ?? null,
        status: "completed",
      })
      .onConflictDoNothing()
      .returning({ id: purchases.id });

    if (insertedPurchases.length === 0) {
      // Concurrent transaction already inserted this purchase
      return false;
    }

    // 5. Grant course-scoped entitlement (Invariant #3, #8)
    const entitlementId = crypto.randomUUID();
    await tx
      .insert(entitlements)
      .values({
        id: entitlementId,
        userId,
        courseId,
        source: "purchase",
      })
      .onConflictDoNothing();

    return true;
  });
}

/**
 * Handles charge.refunded for one-time purchases.
 * Invariant #6 (D5): Revokes purchase-sourced entitlement ONLY on full refund;
 * partial refund retains access. Progress rows are never touched.
 */
export async function handlePurchaseRefund(
  charge: Stripe.Charge,
  ctx: FulfillmentContext
): Promise<boolean> {
  // Invariant #6 / D5: Only full refunds revoke entitlement
  if (charge.refunded !== true) {
    return false; // Partial refund -> retain access, explicit no-op
  }

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    console.warn("charge.refunded received without payment_intent ID", charge.id);
    return false;
  }

  return await db.transaction(async (tx) => {
    if (await isEventAlreadyProcessed(tx, ctx.eventId)) {
      return false;
    }

    await recordProcessedEvent(tx, ctx);

    const [purchase] = await tx
      .select()
      .from(purchases)
      .where(eq(purchases.stripePaymentIntentId, paymentIntentId))
      .limit(1);

    // If purchase row is missing, record refund tombstone (Fix 8)
    if (!purchase) {
      await tx.insert(refundTombstones).values({
        stripePaymentIntentId: paymentIntentId,
      });
      return true;
    }

    // Update purchase status
    await tx
      .update(purchases)
      .set({ status: "refunded" })
      .where(eq(purchases.id, purchase.id));

    // Revoke course-scoped purchase entitlement (Invariant #6)
    await revokePurchaseEntitlement(purchase.userId, purchase.courseId, tx);

    return true;
  });
}
