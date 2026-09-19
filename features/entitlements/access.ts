import { eq, and, or, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { entitlements } from "@/lib/db/schema";
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

export type CourseAccessState = "all-access" | "purchased" | "locked";

/**
 * Resolves access states for multiple courses for a given user.
 * Executes a single SQL query and avoids N+1 query patterns.
 *
 * Invariant #1: Strictly reads from `entitlements` where `revoked_at IS NULL`.
 * Dual-Entitlement Precedence: Standalone/comped course license (`courseId !== null`)
 * overrides All-Access (`courseId === null`), returning "purchased".
 */
export async function resolveUserCoursesAccessMap(
  userId: string,
  courseIds: string[]
): Promise<Map<string, CourseAccessState>> {
  const accessMap = new Map<string, CourseAccessState>();
  if (courseIds.length === 0) return accessMap;

  const activeEntitlements = await db
    .select({
      courseId: entitlements.courseId,
      source: entitlements.source,
    })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        isNull(entitlements.revokedAt),
        or(
          isNull(entitlements.courseId),
          inArray(entitlements.courseId, courseIds)
        )
      )
    );

  const hasAllAccessEntitlement = activeEntitlements.some((e) => e.courseId === null);
  const courseSpecificIds = new Set(
    activeEntitlements
      .filter((e) => e.courseId !== null)
      .map((e) => e.courseId!)
  );

  for (const courseId of courseIds) {
    if (courseSpecificIds.has(courseId)) {
      accessMap.set(courseId, "purchased");
    } else if (hasAllAccessEntitlement) {
      accessMap.set(courseId, "all-access");
    } else {
      accessMap.set(courseId, "locked");
    }
  }

  return accessMap;
}

/**
 * Resolves access state for a single course for a user.
 */
export async function resolveCourseAccessState(
  userId: string,
  courseId: string
): Promise<CourseAccessState> {
  const accessMap = await resolveUserCoursesAccessMap(userId, [courseId]);
  return accessMap.get(courseId) ?? "locked";
}
