import { eq, and, or, desc } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { subscriptions } from "@/lib/db/schema";
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
 * Returns the user's most recent subscription row for billing UI display only.
 * Not an authoritative entitlement check (see Invariant #1: entitlements table is the single source of truth).
 */
export async function getLatestSubscriptionByUserId(
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

/**
 * Returns the user's active/trialing subscription for billing UI display only.
 * Not an authoritative entitlement check (see Invariant #1: entitlements table is the single source of truth).
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

  return activeSub ?? null;
}
