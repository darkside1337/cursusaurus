import { eq } from "drizzle-orm";
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
