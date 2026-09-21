"use server";

import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { getServerSession } from "@/lib/auth";
import { env } from "@/config/env";
import { getCourseById, getCourseReadiness } from "@/features/courses/queries";
import { purchases, entitlements, subscriptions } from "@/lib/db/schema";
import { logActionError } from "@/lib/action-errors";
import { createPurchaseCheckoutSession } from "./checkout";

export interface CreateCourseCheckoutResult {
  url?: string;
  error?: string;
  loginUrl?: string;
}

/**
 * Server action to initiate a one-time purchase checkout session for a course.
 *
 * NOTE on Rate Limiting (M3):
 * Request-level checkout rate limiting is intentionally deferred from this phase until there
 * is a demonstrated operational requirement. The business invariants below (e.g. single
 * completed purchase per course guard Invariant #12) prevent duplicate or invalid purchases
 * in the domain, but are not a substitute for request-level rate limiting.
 */
export async function createCourseCheckoutSessionAction(
  courseId: string
): Promise<CreateCourseCheckoutResult> {
  const session = await getServerSession();
  const user = session?.user;

  const course = await getCourseById(courseId);
  if (!course) {
    return { error: "Course not found" };
  }

  if (!user) {
    return {
      error: "unauthorized",
      loginUrl: `/login?callbackUrl=/${course.slug}`,
    };
  }

  if (!course.isPublished) {
    return { error: "Course is not currently available for purchase" };
  }

  const readiness = await getCourseReadiness(course.id);
  if (!readiness || !readiness.isPurchaseEligible) {
    return { error: "Course lectures are still being curated" };
  }

  // Check if user already owns this course outright (Invariant #12)
  // Note: We do NOT use hasAccess() here so subscribers can purchase perpetual licenses.
  const [existingPurchase] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(
      and(
        eq(purchases.userId, user.id),
        eq(purchases.courseId, course.id),
        eq(purchases.status, "completed")
      )
    )
    .limit(1);

  const [existingEntitlement] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, user.id),
        eq(entitlements.courseId, course.id),
        eq(entitlements.source, "purchase"),
        isNull(entitlements.revokedAt)
      )
    )
    .limit(1);

  if (existingPurchase || existingEntitlement) {
    return { error: "You already own this course monograph." };
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
  const cancelUrl = `${baseUrl}/${course.slug}`;

  try {
    const checkoutSession = await createPurchaseCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      stripeCustomerId: recentSub?.stripeCustomerId,
      courseId: course.id,
      successUrl,
      cancelUrl,
    });

    return { url: checkoutSession.url };
  } catch (err) {
    logActionError("createCourseCheckoutSessionAction", err, {
      userId: user.id,
      courseId: course.id,
    });
    return { error: "Failed to create checkout session. Please try again." };
  }
}
