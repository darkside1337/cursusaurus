import { eq, and, isNull, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { courses, lessons, lessonProgress, user, entitlements, subscriptions } from "@/lib/db/schema";
import type { LearnerLibrarySummary, LibraryCourseItem, LibraryNextLesson } from "./types";

export async function getLearnerLibrary(userId: string): Promise<LearnerLibrarySummary> {
  // 1. Invariant #1: Query active entitlements only
  const activeEntitlements = await db
    .select({
      courseId: entitlements.courseId,
      source: entitlements.source,
    })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        isNull(entitlements.revokedAt)
      )
    );

  const hasAllAccess = activeEntitlements.some((e) => e.courseId === null);
  const purchasedCourseIds = new Set(
    activeEntitlements
      .filter((e) => e.courseId !== null)
      .map((e) => e.courseId!)
  );

  // 2. Determine which courses the learner has active access to
  let targetCourseRows: Array<{
    course: typeof courses.$inferSelect;
    creatorName: string | null;
  }> = [];

  if (hasAllAccess) {
    // All-Access: all published courses
    targetCourseRows = await db
      .select({
        course: courses,
        creatorName: user.name,
      })
      .from(courses)
      .leftJoin(user, eq(courses.creatorId, user.id))
      .where(eq(courses.isPublished, true))
      .orderBy(asc(courses.title));
  } else if (purchasedCourseIds.size > 0) {
    // Purchase-only: matching owned course IDs
    targetCourseRows = await db
      .select({
        course: courses,
        creatorName: user.name,
      })
      .from(courses)
      .leftJoin(user, eq(courses.creatorId, user.id))
      .where(
        and(
          eq(courses.isPublished, true),
          inArray(courses.id, Array.from(purchasedCourseIds))
        )
      )
      .orderBy(asc(courses.title));
  }

  if (targetCourseRows.length === 0) {
    return {
      courses: [],
      metrics: { activeSyllabiCount: 0, hoursMastered: 0, completedSyllabiCount: 0 },
      isSubscriptionPastDue: false,
      hasAllAccess,
    };
  }

  const targetCourseIds = targetCourseRows.map((r) => r.course.id);

  // 3. Batch-fetch lessons, progress records, and subscription status in parallel
  //    (eliminates 2K serial queries — was 2 round-trips per accessible course)
  const [allLessons, allProgress, subRow] = await Promise.all([
    db
      .select()
      .from(lessons)
      .where(inArray(lessons.courseId, targetCourseIds))
      .orderBy(asc(lessons.courseId), asc(lessons.orderIndex)),
    db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          inArray(lessonProgress.courseId, targetCourseIds)
        )
      ),
    db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  // Group lessons and progress by courseId in memory
  const lessonsByCourse = new Map<string, (typeof allLessons)[number][]>();
  for (const lesson of allLessons) {
    const arr = lessonsByCourse.get(lesson.courseId) ?? [];
    arr.push(lesson);
    lessonsByCourse.set(lesson.courseId, arr);
  }

  const progressByLesson = new Map(allProgress.map((p) => [p.lessonId, p]));

  // 4. Compute per-course stats — loop body is now fully synchronous
  const libraryItems: LibraryCourseItem[] = [];

  for (const { course, creatorName } of targetCourseRows) {
    const courseLessons = lessonsByCourse.get(course.id) ?? [];

    // Exclude published courses that have 0 lessons (Coming Soon per PRD §8)
    if (courseLessons.length === 0) {
      continue;
    }

    let completedCount = 0;
    let completedDuration = 0;
    let totalDuration = 0;
    let nextLesson: LibraryNextLesson | null = null;

    for (const l of courseLessons) {
      const duration = l.durationSeconds ?? 0;
      totalDuration += duration;
      const progress = progressByLesson.get(l.id);

      if (progress?.completed) {
        completedCount++;
        completedDuration += duration;
      } else if (!nextLesson) {
        nextLesson = {
          id: l.id,
          orderIndex: l.orderIndex,
          slug: l.slug,
          title: l.title,
        };
      }
    }

    // If all lessons are completed, next lesson points to the first lesson for rewatching
    if (!nextLesson && courseLessons.length > 0) {
      const first = courseLessons[0];
      nextLesson = {
        id: first.id,
        orderIndex: first.orderIndex,
        slug: first.slug,
        title: first.title,
      };
    }

    const totalLessons = courseLessons.length;
    const progressPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    const isCompleted = totalLessons > 0 && completedCount === totalLessons;
    const isPurchased = purchasedCourseIds.has(course.id);

    libraryItems.push({
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      category: course.category,
      thumbnailUrl: course.thumbnailUrl,
      creatorName,
      accessType: isPurchased ? "purchased" : "all-access",
      lessonCount: totalLessons,
      completedLessonsCount: completedCount,
      progressPercentage,
      totalDurationSeconds: totalDuration,
      completedDurationSeconds: completedDuration,
      isCompleted,
      nextLesson,
    });
  }

  // 5. Compute workspace metrics strictly over accessible courses
  const activeSyllabiCount = libraryItems.filter(
    (item) => item.completedLessonsCount > 0
  ).length;

  const totalCompletedSeconds = libraryItems.reduce(
    (acc, item) => acc + item.completedDurationSeconds,
    0
  );
  const hoursMastered = Math.round((totalCompletedSeconds / 3600) * 10) / 10;

  const completedSyllabiCount = libraryItems.filter(
    (item) => item.isCompleted
  ).length;

  const isSubscriptionPastDue = subRow?.status === "past_due";

  return {
    courses: libraryItems,
    metrics: {
      activeSyllabiCount,
      hoursMastered,
      completedSyllabiCount,
    },
    isSubscriptionPastDue,
    hasAllAccess,
  };
}
