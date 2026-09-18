import type Stripe from "stripe";
import { handleSubscriptionCheckoutCompleted } from "./handlers";
import type { FulfillmentContext } from "@/features/stripe/types";

/**
 * Reconciles an All-Access subscription checkout session.
 * Reuses the same idempotent domain fulfillment logic used by webhooks (Invariant #10).
 */
export async function reconcileSubscriptionSession(
  session: Stripe.Checkout.Session,
  preloadedSub?: Stripe.Subscription
): Promise<boolean> {
  if (session.mode !== "subscription") {
    return false;
  }

  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return false;
  }

  const ctx: FulfillmentContext = {
    eventId: `reconcile_${session.id}`,
    eventEpoch: session.created,
    eventType: "reconcile.subscription.session",
  };

  return await handleSubscriptionCheckoutCompleted(session, ctx, preloadedSub);
}
