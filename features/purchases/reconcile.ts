import type Stripe from "stripe";
import { handlePurchaseCheckoutCompleted } from "./handlers";
import type { FulfillmentContext } from "@/features/stripe/types";

/**
 * Reconciles a one-time purchase checkout session.
 * Reuses the same idempotent domain fulfillment logic used by webhooks (Invariant #10).
 */
export async function reconcileCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<boolean> {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return false;
  }

  const ctx: FulfillmentContext = {
    eventId: `reconcile_${session.id}`,
    eventEpoch: session.created,
    eventType: "reconcile.checkout.session",
  };

  return await handlePurchaseCheckoutCompleted(session, ctx);
}
