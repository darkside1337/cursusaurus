import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { purchases, courses } from "@/lib/db/schema";
import type { Purchase, PurchaseOrderStatusResult } from "./types";

export async function getPurchaseById(purchaseId: string): Promise<Purchase | null> {
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .limit(1);

  return purchase ?? null;
}

export async function getPurchaseBySessionId(sessionId: string): Promise<Purchase | null> {
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.stripeSessionId, sessionId))
    .limit(1);

  return purchase ?? null;
}

export async function getOrderStatus(sessionId: string): Promise<PurchaseOrderStatusResult> {
  const [record] = await db
    .select({
      purchase: purchases,
      course: courses,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(eq(purchases.stripeSessionId, sessionId))
    .limit(1);

  if (!record) {
    return { status: "pending" };
  }

  if (record.purchase.status === "completed" || record.purchase.status === "succeeded") {
    return {
      status: "completed",
      courseId: record.course.id,
      courseSlug: record.course.slug,
    };
  }

  if (record.purchase.status === "failed") {
    return { status: "failed" };
  }

  return { status: "pending" };
}

export interface UserPurchasedCourseItem {
  id: string;
  purchasedAt: Date;
  pricePaidCents: number | null;
  status: string;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    priceCents: number;
  };
}

/**
 * Lists all course purchases for a user, sorted newest first, with joined course metadata.
 * Drives the Purchased Courses ledger on the /billing page.
 */
export async function listPurchasesByUserWithCourse(
  userId: string
): Promise<UserPurchasedCourseItem[]> {
  const rows = await db
    .select({
      purchase: purchases,
      course: courses,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(eq(purchases.userId, userId))
    .orderBy(desc(purchases.purchasedAt));

  return rows.map(({ purchase, course }) => ({
    id: purchase.id,
    purchasedAt: purchase.purchasedAt,
    pricePaidCents: purchase.pricePaidCents ?? course.priceCents,
    status: purchase.status,
    course: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      thumbnailUrl: course.thumbnailUrl,
      priceCents: course.priceCents,
    },
  }));
}
