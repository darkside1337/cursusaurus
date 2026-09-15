import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchases, courses } from "@/db/schema";
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

  if (record.purchase.status === "succeeded" || record.purchase.status === "completed") {
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
