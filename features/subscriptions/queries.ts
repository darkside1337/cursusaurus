import { eq, and, or, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/db/schema";
import type { Subscription } from "./types";

export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return sub ?? null;
}

export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string
): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  return sub ?? null;
}

export async function getSubscriptionBySessionId(
  sessionId: string
): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSessionId, sessionId))
    .limit(1);

  return sub ?? null;
}

/**
 * Returns the user's current subscription.
 * Prioritizes active/trialing status, falling back to the most recent row.
 */
export async function getActiveSubscriptionByUserId(
  userId: string
): Promise<Subscription | null> {
  const [activeSub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        or(
          eq(subscriptions.status, "active"),
          eq(subscriptions.status, "trialing")
        )
      )
    )
    .limit(1);

  if (activeSub) return activeSub;

  const [mostRecent] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return mostRecent ?? null;
}
