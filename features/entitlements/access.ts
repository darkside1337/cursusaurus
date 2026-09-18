import { eq, and, or, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { entitlements } from "@/db/schema";
import { hasAccessSchema } from "./schemas";

/**
 * Checks whether a user has access to a specific course.
 *
 * INVARIANT #1: `entitlements` is the sole table read for access decisions.
 * Never queries `purchases` or `subscriptions` directly.
 *
 * Access is granted if:
 * 1. User has an active course-scoped entitlement (`course_id = courseId`)
 * 2. OR user has an active all-access entitlement (`course_id = null`, Invariant #3)
 * AND `revoked_at` is null.
 */
export async function hasAccess(userId: string, courseId: string): Promise<boolean> {
  const validated = hasAccessSchema.parse({ userId, courseId });

  const [record] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, validated.userId),
        isNull(entitlements.revokedAt),
        or(
          eq(entitlements.courseId, validated.courseId),
          isNull(entitlements.courseId)
        )
      )
    )
    .limit(1);

  return Boolean(record);
}

/**
 * Authoritative check for whether a user currently has active All-Access.
 *
 * INVARIANT #1: `entitlements` is the sole table read for access decisions.
 * Never queries `subscriptions` directly for entitlement state.
 *
 * Returns true if an unrevoked All-Access entitlement (courseId = null) exists.
 */
export async function hasAllAccess(userId: string): Promise<boolean> {
  const [record] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        isNull(entitlements.courseId),
        isNull(entitlements.revokedAt)
      )
    )
    .limit(1);

  return Boolean(record);
}
