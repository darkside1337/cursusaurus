import type Stripe from "stripe";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { stripe } from "@/lib/stripe";
import { subscriptions, entitlements } from "@/lib/db/schema";
import { revokeSubscriptionEntitlements } from "@/features/entitlements/writers";
import { isEventAlreadyProcessed, recordProcessedEvent } from "@/features/stripe/idempotency";
import type { FulfillmentContext } from "@/features/stripe/types";
import type { SubscriptionStatus } from "./types";

interface SubscriptionUpsertData {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripeSessionId?: string | null;
  status: SubscriptionStatus | Stripe.Subscription.Status;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
  lastEventEpoch: number;
}

/**
 * Shared idempotent upsert for subscriptions and entitlements.
 * Preserves existing stripeSessionId on subsequent updates (Fix 6).
 */
export async function upsertSubscription(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  data: SubscriptionUpsertData
) {
  const [existingSub] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, data.stripeSubscriptionId))
    .limit(1);

  let targetUserId = data.userId;

  if (!existingSub) {
    await tx
      .insert(subscriptions)
      .values({
        id: crypto.randomUUID(),
        userId: data.userId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripeCustomerId: data.stripeCustomerId,
        stripeSessionId: data.stripeSessionId ?? null,
        status: data.status,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        trialEndsAt: data.trialEndsAt,
        lastEventEpoch: data.lastEventEpoch,
      })
      .onConflictDoNothing();
  } else {
    targetUserId = existingSub.userId;
    await tx
      .update(subscriptions)
      .set({
        status: data.status,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        trialEndsAt: data.trialEndsAt,
        lastEventEpoch: data.lastEventEpoch,
        stripeSessionId: data.stripeSessionId ?? existingSub.stripeSessionId,
      })
      .where(eq(subscriptions.id, existingSub.id));
  }

  // Update entitlement per Invariant #5 & D11:
  // trialing / active grant; past_due / canceled / unpaid / incomplete_expired revoke immediately;
  // incomplete / paused never grant (revoke if present).
  if (data.status === "active" || data.status === "trialing") {
    const [existingEntitlement] = await tx
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, targetUserId),
          isNull(entitlements.courseId),
          eq(entitlements.source, "subscription"),
          isNull(entitlements.revokedAt)
        )
      )
      .limit(1);

    if (!existingEntitlement) {
      await tx
        .insert(entitlements)
        .values({
          id: crypto.randomUUID(),
          userId: targetUserId,
          courseId: null,
          source: "subscription",
        })
        .onConflictDoNothing();
    }
  } else {
    // Revoke subscription all-access entitlement (Invariant #4)
    await revokeSubscriptionEntitlements(targetUserId, tx);
  }
}

function extractSubscriptionTimestamps(subscription: Stripe.Subscription) {
  const currentPeriodEndEpoch =
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.trial_end ??
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  const currentPeriodEnd = new Date(currentPeriodEndEpoch * 1000);
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  return {
    currentPeriodEnd,
    trialEndsAt,
    cancelAtPeriodEnd,
    customerId,
  };
}

/**
 * Handles customer.subscription.created.
 * Uses insert-if-missing pattern to avoid same-second epoch races (Fix 1.4).
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  ctx: FulfillmentContext
): Promise<boolean> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn("customer.subscription.created received without metadata.userId", subscription.id);
    return false;
  }

  const { currentPeriodEnd, trialEndsAt, cancelAtPeriodEnd, customerId } =
    extractSubscriptionTimestamps(subscription);

  return await db.transaction(async (tx) => {
    // 1. Idempotency check
    if (await isEventAlreadyProcessed(tx, ctx.eventId)) {
      return false;
    }

    // 2. Check if row already exists (same-second race protection)
    const [existingSub] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (existingSub) {
      // Row already created by checkout.session.completed or newer event
      await recordProcessedEvent(tx, ctx);
      return false;
    }

    await recordProcessedEvent(tx, ctx);

    await upsertSubscription(tx, {
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      status: subscription.status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      trialEndsAt,
      lastEventEpoch: ctx.eventEpoch,
    });

    return true;
  });
}

/**
 * Handles customer.subscription.updated.
 * Enforces epoch guard (D3 / Invariant #9) and self-heals missing rows.
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  ctx: FulfillmentContext
): Promise<boolean> {
  const userId = subscription.metadata?.userId;
  const { currentPeriodEnd, trialEndsAt, cancelAtPeriodEnd, customerId } =
    extractSubscriptionTimestamps(subscription);

  return await db.transaction(async (tx) => {
    // 1. Idempotency check
    if (await isEventAlreadyProcessed(tx, ctx.eventId)) {
      return false;
    }

    // 2. Check existing row and epoch guard
    const [existingSub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (existingSub && existingSub.lastEventEpoch !== null) {
      // Prevent zombie resurrection if already canceled
      if (existingSub.status === "canceled" && ctx.eventEpoch <= existingSub.lastEventEpoch) {
        return false;
      }
      // Stripe's event.created timestamp has whole-second resolution. Legitimate
      // customer.subscription.created and customer.subscription.updated events often share
      // the exact same second. We strictly use '<' for active lifecycles so same-second
      // progressions succeed.
      if (ctx.eventEpoch < existingSub.lastEventEpoch) {
        // Out-of-order stale event -> ignore
        return false;
      }
    }

    await recordProcessedEvent(tx, ctx);

    const targetUserId = existingSub?.userId || userId;
    if (!targetUserId) {
      console.warn("Subscription update for missing row without userId metadata", subscription.id);
      return false;
    }

    await upsertSubscription(tx, {
      userId: targetUserId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      status: subscription.status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      trialEndsAt,
      lastEventEpoch: ctx.eventEpoch,
    });

    return true;
  });
}

/**
 * Handles customer.subscription.deleted.
 * Enforces epoch guard, revokes all-access entitlement only (Invariant #4),
 * and creates a canceled tombstone if row is missing (D9).
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  ctx: FulfillmentContext
): Promise<boolean> {
  const userId = subscription.metadata?.userId;
  const { currentPeriodEnd, trialEndsAt, cancelAtPeriodEnd, customerId } =
    extractSubscriptionTimestamps(subscription);

  return await db.transaction(async (tx) => {
    // 1. Idempotency check
    if (await isEventAlreadyProcessed(tx, ctx.eventId)) {
      return false;
    }

    const [existingSub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (existingSub && existingSub.lastEventEpoch !== null) {
      if (existingSub.status === "canceled" && ctx.eventEpoch <= existingSub.lastEventEpoch) {
        return false;
      }
      if (ctx.eventEpoch < existingSub.lastEventEpoch) {
        return false;
      }
    }

    await recordProcessedEvent(tx, ctx);

    if (!existingSub) {
      // Missing row tombstone (D9)
      if (userId) {
        await tx.insert(subscriptions).values({
          id: crypto.randomUUID(),
          userId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customerId,
          status: "canceled",
          currentPeriodEnd,
          cancelAtPeriodEnd,
          trialEndsAt,
          lastEventEpoch: ctx.eventEpoch,
        });
      }
      return true;
    }

    // Update status to canceled
    await tx
      .update(subscriptions)
      .set({
        status: "canceled",
        lastEventEpoch: ctx.eventEpoch,
      })
      .where(eq(subscriptions.id, existingSub.id));

    // Revoke all-access entitlement only (Invariant #4)
    await revokeSubscriptionEntitlements(existingSub.userId, tx);

    return true;
  });
}

/**
 * Handles checkout.session.completed for subscription mode (D4).
 * Accepts 'paid' or 'no_payment_required' (7-day trial, Fix 1.2).
 * Allows preloadedSub parameter for pure unit testing without network calls (Fix 2.3).
 */
export async function handleSubscriptionCheckoutCompleted(
  session: Stripe.Checkout.Session,
  ctx: FulfillmentContext,
  preloadedSub?: Stripe.Subscription
): Promise<boolean> {
  if (session.mode !== "subscription") {
    return false;
  }

  // Accept paid or no_payment_required (free trials have no upfront charge)
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return false;
  }

  const userId = session.metadata?.userId || session.client_reference_id;
  if (!userId) {
    throw new Error("Missing userId in subscription checkout session metadata");
  }

  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subId && !preloadedSub) {
    throw new Error("Missing subscription ID in checkout session");
  }

  // Pure testing seam: Use preloadedSub or fetch authoritative Stripe subscription
  const subscription = preloadedSub ?? (await stripe.subscriptions.retrieve(subId as string));

  const { currentPeriodEnd, trialEndsAt, cancelAtPeriodEnd, customerId } =
    extractSubscriptionTimestamps(subscription);

  return await db.transaction(async (tx) => {
    if (await isEventAlreadyProcessed(tx, ctx.eventId)) {
      return false;
    }

    await recordProcessedEvent(tx, ctx);

    await upsertSubscription(tx, {
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripeSessionId: session.id,
      status: subscription.status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      trialEndsAt,
      lastEventEpoch: ctx.eventEpoch,
    });

    return true;
  });
}

/**
 * Safely extracts the subscription ID from a Stripe invoice across API versions.
 * Supports newer versions (invoice.parent?.subscription_details?.subscription)
 * and legacy versions (invoice.subscription).
 */
export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription } };
    subscription?: string | Stripe.Subscription;
  };
  const sub = inv.parent?.subscription_details?.subscription ?? inv.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/**
 * Handles invoice.payment_succeeded and invoice.payment_failed.
 * Collapses both into a single thin path:
 * getInvoiceSubscriptionId -> stripe.subscriptions.retrieve -> upsertSubscription.
 * 
 * Reuses the epoch guard in upsertSubscription / handlers.
 * Safe against duplicate delivery (idempotency table) and out-of-order delivery
 * (fetching current authoritative subscription state directly from Stripe).
 */
export async function handleInvoiceEvent(
  invoice: Stripe.Invoice,
  ctx: FulfillmentContext,
  preloadedSub?: Stripe.Subscription
): Promise<boolean> {
  const subId = getInvoiceSubscriptionId(invoice);
  if (!subId && !preloadedSub) {
    return false;
  }

  // Pure unit testing seam: Use preloadedSub or fetch authoritative Stripe subscription
  const subscription = preloadedSub ?? (await stripe.subscriptions.retrieve(subId as string));

  const { currentPeriodEnd, trialEndsAt, cancelAtPeriodEnd, customerId } =
    extractSubscriptionTimestamps(subscription);

  return await db.transaction(async (tx) => {
    // 1. Idempotency check
    if (await isEventAlreadyProcessed(tx, ctx.eventId)) {
      return false;
    }

    // 2. Epoch guard
    const [existingSub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (existingSub && existingSub.lastEventEpoch !== null) {
      if (existingSub.status === "canceled" && ctx.eventEpoch <= existingSub.lastEventEpoch) {
        return false;
      }
      if (ctx.eventEpoch < existingSub.lastEventEpoch) {
        return false;
      }
    }

    await recordProcessedEvent(tx, ctx);

    const targetUserId = existingSub?.userId || subscription.metadata?.userId;
    if (!targetUserId) {
      console.warn("Invoice event for subscription without userId metadata or existing record", subscription.id);
      return false;
    }

    await upsertSubscription(tx, {
      userId: targetUserId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      status: subscription.status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      trialEndsAt,
      lastEventEpoch: ctx.eventEpoch,
    });

    return true;
  });
}
