import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { purchases, subscriptions, courses, reconcileAttempts } from "@/db/schema";
import { hasAccess, hasAllAccess } from "@/features/entitlements/access";
import { getCourseById } from "@/features/courses/queries";
import { reconcileCheckoutSession } from "@/features/purchases/reconcile";
import { reconcileSubscriptionSession } from "@/features/subscriptions/reconcile";

export async function GET(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;

  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Check purchases table (DB-first)
  const [purchaseRecord] = await db
    .select({
      purchase: purchases,
      course: courses,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(eq(purchases.stripeSessionId, sessionId))
    .limit(1);

  if (purchaseRecord) {
    // Ownership check (D7: unowned ids return 404 to avoid enumeration)
    if (purchaseRecord.purchase.userId !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isEntitled = await hasAccess(user.id, purchaseRecord.course.id);
    const status =
      purchaseRecord.purchase.status === "completed"
        ? "completed"
        : purchaseRecord.purchase.status === "failed"
          ? "failed"
          : "pending";

    return NextResponse.json({
      status,
      type: "purchase",
      courseId: purchaseRecord.course.id,
      courseSlug: purchaseRecord.course.slug,
      courseTitle: purchaseRecord.course.title,
      isEntitled,
    });
  }

  // 2. Check subscriptions table (DB-first)
  const [subscriptionRecord] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSessionId, sessionId))
    .limit(1);

  if (subscriptionRecord) {
    if (subscriptionRecord.userId !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isEntitled = await hasAllAccess(user.id);
    const isComplete =
      subscriptionRecord.status === "active" ||
      subscriptionRecord.status === "trialing";

    return NextResponse.json({
      status: isComplete ? "completed" : "pending",
      type: "subscription",
      isEntitled,
    });
  }

  // 3. Pre-reconcile path: atomic insert claim before retrieving or fulfilling from Stripe
  // This eliminates TOCTOU races between concurrent polling requests.
  const [claimed] = await db
    .insert(reconcileAttempts)
    .values({
      stripeSessionId: sessionId,
      userId: user.id,
      status: "processing",
    })
    .onConflictDoNothing()
    .returning({ stripeSessionId: reconcileAttempts.stripeSessionId });

  if (!claimed) {
    // Another request is currently processing or has already attempted reconciliation; wait on DB state
    return NextResponse.json({
      status: "pending",
      isEntitled: false,
    });
  }

  // On-demand single-shot reconciliation (D7 / D10)
  try {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify session ownership
    const sessionUserId =
      stripeSession.metadata?.userId || stripeSession.client_reference_id;

    if (sessionUserId !== user.id) {
      await db
        .update(reconcileAttempts)
        .set({ status: "failed", error: "Unauthorized session access" })
        .where(eq(reconcileAttempts.stripeSessionId, sessionId));
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check expiration / abandonment
    if (stripeSession.status === "expired") {
      await db
        .update(reconcileAttempts)
        .set({ status: "failed", error: "Checkout session expired" })
        .where(eq(reconcileAttempts.stripeSessionId, sessionId));

      return NextResponse.json({
        status: "failed",
        isEntitled: false,
      });
    }

    if (stripeSession.mode === "payment") {
      if (stripeSession.payment_status === "paid") {
        await reconcileCheckoutSession(stripeSession);

        await db
          .update(reconcileAttempts)
          .set({ status: "completed" })
          .where(eq(reconcileAttempts.stripeSessionId, sessionId));

        const courseId = stripeSession.metadata?.courseId;
        const course = courseId ? await getCourseById(courseId) : null;
        const isEntitled = courseId ? await hasAccess(user.id, courseId) : false;

        return NextResponse.json({
          status: "completed",
          type: "purchase",
          courseId: course?.id,
          courseSlug: course?.slug,
          courseTitle: course?.title,
          isEntitled,
        });
      }

      // Payment not completed yet; release claim so subsequent polls can reconcile once paid
      await db
        .delete(reconcileAttempts)
        .where(eq(reconcileAttempts.stripeSessionId, sessionId));

      return NextResponse.json({
        status: "pending",
        type: "purchase",
        isEntitled: false,
      });
    }

    if (stripeSession.mode === "subscription") {
      if (
        stripeSession.payment_status === "paid" ||
        stripeSession.payment_status === "no_payment_required"
      ) {
        await reconcileSubscriptionSession(stripeSession);

        await db
          .update(reconcileAttempts)
          .set({ status: "completed" })
          .where(eq(reconcileAttempts.stripeSessionId, sessionId));

        const isEntitled = await hasAllAccess(user.id);

        return NextResponse.json({
          status: "completed",
          type: "subscription",
          isEntitled,
        });
      }

      // Subscription payment not ready; release claim so subsequent polls can reconcile
      await db
        .delete(reconcileAttempts)
        .where(eq(reconcileAttempts.stripeSessionId, sessionId));

      return NextResponse.json({
        status: "pending",
        type: "subscription",
        isEntitled: false,
      });
    }

    await db
      .delete(reconcileAttempts)
      .where(eq(reconcileAttempts.stripeSessionId, sessionId));

    return NextResponse.json({
      status: "pending",
      isEntitled: false,
    });
  } catch (err) {
    console.error("Reconciliation retrieve failed for session:", sessionId, err);
    // Delete claim so subsequent polls can retry if this was a transient network error (Fix 7)
    await db
      .delete(reconcileAttempts)
      .where(eq(reconcileAttempts.stripeSessionId, sessionId));

    return NextResponse.json({
      status: "pending",
      isEntitled: false,
    });
  }
}
