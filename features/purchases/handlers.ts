import type Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchases, entitlements, processedStripeEvents } from "@/db/schema";

/**
 * Handles checkout.session.completed for one-time course purchases.
 * Writes purchase record + course-scoped entitlement in a single transaction (Invariant #8).
 * Ensures idempotency via processed_stripe_events (Invariant #7).
 */
export async function handlePurchaseCheckoutCompleted(
  session: Stripe.Checkout.Session,
  eventId: string
): Promise<boolean> {
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
    const [alreadyProcessed] = await tx
      .select()
      .from(processedStripeEvents)
      .where(eq(processedStripeEvents.eventId, eventId))
      .limit(1);

    if (alreadyProcessed) {
      return false; // Already handled
    }

    await tx.insert(processedStripeEvents).values({
      id: crypto.randomUUID(),
      eventId,
      eventType: "checkout.session.completed",
    });

    // 2. Insert purchase record
    const purchaseId = crypto.randomUUID();
    await tx.insert(purchases).values({
      id: purchaseId,
      userId,
      courseId,
      stripePaymentIntentId: paymentIntentId,
      stripeSessionId: session.id,
      status: "completed",
    });

    // 3. Grant course-scoped entitlement (Invariant #3, #8)
    const entitlementId = crypto.randomUUID();
    await tx.insert(entitlements).values({
      id: entitlementId,
      userId,
      courseId,
      source: "purchase",
    });

    return true;
  });
}

/**
 * Handles charge.refunded or payment_intent refund for one-time purchases.
 * Revokes purchase-sourced entitlement only; lesson_progress rows are never touched (Invariant #6).
 */
export async function handlePurchaseRefund(
  paymentIntentId: string,
  eventId: string
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const [alreadyProcessed] = await tx
      .select()
      .from(processedStripeEvents)
      .where(eq(processedStripeEvents.eventId, eventId))
      .limit(1);

    if (alreadyProcessed) {
      return false;
    }

    await tx.insert(processedStripeEvents).values({
      id: crypto.randomUUID(),
      eventId,
      eventType: "charge.refunded",
    });

    const [purchase] = await tx
      .select()
      .from(purchases)
      .where(eq(purchases.stripePaymentIntentId, paymentIntentId))
      .limit(1);

    if (!purchase) {
      return false;
    }

    // Update purchase status
    await tx
      .update(purchases)
      .set({ status: "refunded" })
      .where(eq(purchases.id, purchase.id));

    // Revoke course-scoped purchase entitlement (Invariant #6)
    await tx
      .update(entitlements)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(entitlements.userId, purchase.userId),
          eq(entitlements.courseId, purchase.courseId),
          eq(entitlements.source, "purchase")
        )
      );

    return true;
  });
}
