import type Stripe from "stripe";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions, entitlements, processedStripeEvents } from "@/db/schema";

/**
 * Handles customer.subscription.created.
 * Writes subscriptions row + all-access entitlements row (course_id = null) in a single transaction (Invariant #3, #8).
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  eventId: string
): Promise<boolean> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    throw new Error("Missing userId in subscription metadata");
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const currentPeriodEndEpoch =
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.trial_end ??
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const currentPeriodEnd = new Date(currentPeriodEndEpoch * 1000);
  const status = subscription.status;

  return await db.transaction(async (tx) => {
    // 1. Idempotency check (Invariant #7)
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
      eventType: "customer.subscription.created",
    });

    // 2. Insert subscription
    await tx.insert(subscriptions).values({
      id: crypto.randomUUID(),
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd,
    });

    // 3. Grant all-access entitlement if active or trialing (Invariant #3, #5)
    if (status === "active" || status === "trialing") {
      await tx.insert(entitlements).values({
        id: crypto.randomUUID(),
        userId,
        courseId: null, // null = all-access (Invariant #3)
        source: "subscription",
      });
    }

    return true;
  });
}

/**
 * Handles customer.subscription.updated.
 * trialing / active keep entitlement live; past_due / unpaid / canceled revokes immediately (Invariant #5).
 * If cancel_at_period_end is true, entitlement remains live until deleted.
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  eventId: string
): Promise<boolean> {
  const currentPeriodEndEpoch =
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.trial_end ??
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const currentPeriodEnd = new Date(currentPeriodEndEpoch * 1000);
  const status = subscription.status;

  return await db.transaction(async (tx) => {
    // 1. Idempotency check
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
      eventType: "customer.subscription.updated",
    });

    // 2. Update subscription record
    const [existingSub] = await tx
      .update(subscriptions)
      .set({
        status,
        currentPeriodEnd,
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .returning();

    if (!existingSub) {
      return false;
    }

    // 3. Update entitlement per Invariant #5
    if (status === "active" || status === "trialing") {
      // Ensure active all-access entitlement exists
      const [existingEntitlement] = await tx
        .select()
        .from(entitlements)
        .where(
          and(
            eq(entitlements.userId, existingSub.userId),
            isNull(entitlements.courseId),
            eq(entitlements.source, "subscription"),
            isNull(entitlements.revokedAt)
          )
        )
        .limit(1);

      if (!existingEntitlement) {
        await tx.insert(entitlements).values({
          id: crypto.randomUUID(),
          userId: existingSub.userId,
          courseId: null,
          source: "subscription",
        });
      }
    } else if (
      status === "past_due" ||
      status === "canceled" ||
      status === "unpaid"
    ) {
      // Revoke immediately (no grace period per PRD §8)
      await tx
        .update(entitlements)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(entitlements.userId, existingSub.userId),
            isNull(entitlements.courseId),
            eq(entitlements.source, "subscription"),
            isNull(entitlements.revokedAt)
          )
        );
    }

    return true;
  });
}

/**
 * Handles customer.subscription.deleted.
 * Revokes all-access entitlement; purchase-sourced entitlements for any course are untouched (Invariant #4).
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
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
      eventType: "customer.subscription.deleted",
    });

    const [existingSub] = await tx
      .update(subscriptions)
      .set({ status: "canceled" })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .returning();

    if (!existingSub) {
      return false;
    }

    // Revoke subscription-sourced all-access entitlements only (Invariant #4)
    await tx
      .update(entitlements)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(entitlements.userId, existingSub.userId),
          isNull(entitlements.courseId),
          eq(entitlements.source, "subscription"),
          isNull(entitlements.revokedAt)
        )
      );

    return true;
  });
}
