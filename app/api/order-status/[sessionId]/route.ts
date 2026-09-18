import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { purchases, subscriptions, courses, reconcileAttempts } from "@/db/schema";
import { hasAccess } from "@/features/entitlements/access";
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

    const isComplete =
      subscriptionRecord.status === "active" ||
      subscriptionRecord.status === "trialing";

    return NextResponse.json({
      status: isComplete ? "completed" : "pending",
      type: "subscription",
      isEntitled: isComplete,
    });
  }

  // 3. Pre-reconcile path: neither purchase nor subscription recorded yet
  const [attemptRow] = await db
    .select()
    .from(reconcileAttempts)
    .where(eq(reconcileAttempts.stripeSessionId, sessionId))
    .limit(1);

  if (attemptRow) {
    // Already reconciled once; wait on DB state
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
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check expiration / abandonment
    if (stripeSession.status === "expired") {
      await db
        .insert(reconcileAttempts)
        .values({ stripeSessionId: sessionId })
        .onConflictDoNothing();

      return NextResponse.json({
        status: "failed",
        isEntitled: false,
      });
    }

    if (stripeSession.mode === "payment") {
      if (stripeSession.payment_status === "paid") {
        await reconcileCheckoutSession(stripeSession);

        await db
          .insert(reconcileAttempts)
          .values({ stripeSessionId: sessionId })
          .onConflictDoNothing();

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
          .insert(reconcileAttempts)
          .values({ stripeSessionId: sessionId })
          .onConflictDoNothing();

        return NextResponse.json({
          status: "completed",
          type: "subscription",
          isEntitled: true,
        });
      }

      return NextResponse.json({
        status: "pending",
        type: "subscription",
        isEntitled: false,
      });
    }

    return NextResponse.json({
      status: "pending",
      isEntitled: false,
    });
  } catch (err) {
    console.error("Reconciliation retrieve failed for session:", sessionId, err);
    // Leave reconcileAttempts empty so subsequent polls can retry if this was a transient network error (Fix 7)
    return NextResponse.json({
      status: "pending",
      isEntitled: false,
    });
  }
}
