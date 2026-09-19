import { isNull, eq, and } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { entitlements } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth";
import { listPublishedCourses } from "@/features/courses";
import { CatalogContent } from "./catalog-content";

export const revalidate = 0; // Dynamic data for instant availability

export default async function CatalogPage() {
  const session = await getServerSession();
  const courses = await listPublishedCourses();

  let hasAllAccessSubscription = false;
  const userAccessMap: Record<string, "all-access" | "purchased" | "none"> = {};

  if (session?.user?.id) {
    const activeEntitlements = await db
      .select({
        courseId: entitlements.courseId,
      })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, session.user.id),
          isNull(entitlements.revokedAt)
        )
      );

    hasAllAccessSubscription = activeEntitlements.some((e) => e.courseId === null);
    const ownedCourseIds = new Set(
      activeEntitlements.map((e) => e.courseId).filter(Boolean)
    );

    for (const course of courses) {
      if (hasAllAccessSubscription) {
        userAccessMap[course.id] = "all-access";
      } else if (ownedCourseIds.has(course.id)) {
        userAccessMap[course.id] = "purchased";
      } else {
        userAccessMap[course.id] = "none";
      }
    }
  }

  return (
    <CatalogContent
      courses={courses}
      userAccessMap={userAccessMap}
      hasAllAccessSubscription={hasAllAccessSubscription}
    />
  );
}
