import type Stripe from "stripe";
import { db } from "@/lib/db/db";
import { processedStripeEvents } from "@/lib/db/schema";
import {
  handlePurchaseCheckoutCompleted,
  handlePurchaseRefund,
} from "@/features/purchases/handlers";
import {
  handleSubscriptionCheckoutCompleted,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoiceEvent,
} from "@/features/subscriptions/handlers";
import type { FulfillmentContext } from "./types";

export interface DispatchResult {
  handled: boolean;
  eventType: string;
}

/**
 * Centralized Stripe event dispatcher.
 * Routes verified Stripe webhook events to hardened domain handlers.
 */
export async function dispatchStripeEvent(
  event: Stripe.Event
): Promise<DispatchResult> {
  const ctx: FulfillmentContext = {
    eventId: event.id,
    eventEpoch: event.created,
    eventType: event.type,
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment") {
          await handlePurchaseCheckoutCompleted(session, ctx);
          return { handled: true, eventType: event.type };
        } else if (session.mode === "subscription") {
          await handleSubscriptionCheckoutCompleted(session, ctx);
          return { handled: true, eventType: event.type };
        }
        return { handled: false, eventType: event.type };
      }

      // Handle delayed / async payment methods (SEPA, ACH, Boleto) enabled by D13
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment") {
          await handlePurchaseCheckoutCompleted(session, ctx);
          return { handled: true, eventType: event.type };
        } else if (session.mode === "subscription") {
          await handleSubscriptionCheckoutCompleted(session, ctx);
          return { handled: true, eventType: event.type };
        }
        return { handled: false, eventType: event.type };
      }

      case "checkout.session.async_payment_failed": {
        console.warn("Async checkout payment failed for session:", (event.data.object as Stripe.Checkout.Session).id);
        await db
          .insert(processedStripeEvents)
          .values({
            id: crypto.randomUUID(),
            eventId: ctx.eventId,
            eventType: ctx.eventType,
          })
          .onConflictDoNothing();
        return { handled: true, eventType: event.type };
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handlePurchaseRefund(charge, ctx);
        return { handled: true, eventType: event.type };
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription, ctx);
        return { handled: true, eventType: event.type };
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription, ctx);
        return { handled: true, eventType: event.type };
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, ctx);
        return { handled: true, eventType: event.type };
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceEvent(invoice, ctx);
        return { handled: true, eventType: event.type };
      }

      default:
        // Acknowledged unhandled event
        return { handled: false, eventType: event.type };
    }
  } catch (err) {
    // Poison event check: Unresolvable events should be dead-lettered rather than 500-looping
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Missing userId") ||
      message.includes("subscriptions_one_active_user")
    ) {
      console.error("Poison stripe event detected and dead-lettered:", event.id, event.type, message);
      await db
        .insert(processedStripeEvents)
        .values({
          id: crypto.randomUUID(),
          eventId: ctx.eventId,
          eventType: ctx.eventType,
        })
        .onConflictDoNothing();
      return { handled: true, eventType: event.type };
    }

    // Re-throw transient errors (DB outage, Stripe network failure) so Stripe retries
    throw err;
  }
}
