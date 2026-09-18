"use server";

import { eq, and, or, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { env } from "@/config/env";
import { subscriptions } from "@/db/schema";
import { createSubscriptionCheckoutSession } from "./checkout";
import { createCustomerPortalSession } from "./portal";

export interface SubscriptionActionResult {
  url?: string;
  redirectTo?: string;
  error?: string;
  loginUrl?: string;
}

/**
 * Server action to initiate an All-Access subscription checkout with a 7-day trial.
 */
export async function createSubscriptionCheckoutSessionAction(
  callbackUrl = "/billing"
): Promise<SubscriptionActionResult> {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return {
      error: "unauthorized",
      loginUrl: `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    };
  }

  // Active subscription uniqueness guard (D6 / Invariant #11)
  const [existingActiveSub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, user.id),
        or(
          eq(subscriptions.status, "active"),
          eq(subscriptions.status, "trialing")
        )
      )
    )
    .limit(1);

  if (existingActiveSub) {
    return { redirectTo: "/billing" };
  }

  // Stable Stripe customer identity (D12)
  const [recentSub] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
  const successUrl = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}${callbackUrl}`;

  try {
    const checkoutSession = await createSubscriptionCheckoutSession({
      userId: user.id,
      customerEmail: user.email,
      stripeCustomerId: recentSub?.stripeCustomerId,
      successUrl,
      cancelUrl,
    });

    return { url: checkoutSession.url };
  } catch (err) {
    console.error("Error creating subscription checkout session:", err);
    return { error: err instanceof Error ? err.message : "Failed to initiate subscription" };
  }
}

/**
 * Server action to open Stripe Customer Portal for self-service subscription management.
 */
export async function manageSubscriptionAction(): Promise<SubscriptionActionResult> {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return {
      error: "unauthorized",
      loginUrl: "/login?callbackUrl=/billing",
    };
  }

  // Find active/trialing first, then fallback to most recent subscription row
  const [activeSub] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, user.id),
        or(
          eq(subscriptions.status, "active"),
          eq(subscriptions.status, "trialing")
        )
      )
    )
    .limit(1);

  let stripeCustomerId = activeSub?.stripeCustomerId;

  if (!stripeCustomerId) {
    const [recentSub] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    stripeCustomerId = recentSub?.stripeCustomerId;
  }

  if (!stripeCustomerId) {
    return { error: "No active or past subscription found to manage" };
  }

  const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
  const returnUrl = `${baseUrl}/billing`;

  try {
    const portalSession = await createCustomerPortalSession({
      customerId: stripeCustomerId,
      returnUrl,
    });

    return { url: portalSession.url };
  } catch (err) {
    console.error("Error creating customer portal session:", err);
    return { error: err instanceof Error ? err.message : "Failed to open customer portal" };
  }
}
