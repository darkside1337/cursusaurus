import { eq, and, or, asc, desc, isNull, inArray, count } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { courses, lessons, user, entitlements } from "@/lib/db/schema";
import type {
  Course,
  Lesson,
  CourseWithLessons,
  CourseReadiness,
  CourseReadinessStatus,
  CreatorCourseItem,
  CreatorDashboardData,
  CatalogCourseItem,
} from "./types";

export async function getCourseById(courseId: string): Promise<Course | null> {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  return course ?? null;
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  return course ?? null;
}

export async function listPublishedCourses(): Promise<CatalogCourseItem[]> {
  const rows = await db
    .select({
      course: courses,
      creatorName: user.name,
    })
    .from(courses)
    .leftJoin(user, eq(courses.creatorId, user.id))
    .where(eq(courses.isPublished, true))
    .orderBy(desc(courses.createdAt));

  const items: CatalogCourseItem[] = await Promise.all(
    rows.map(async ({ course, creatorName }) => {
      const courseLessons = await listLessonsByCourse(course.id);
      const readiness = calculateCourseReadiness(course, courseLessons);

      return {
        ...course,
        creatorName,
        lessonCount: courseLessons.length,
        totalDurationSeconds: readiness.totalDurationSeconds,
        readiness,
      };
    })
  );

  return items;
}

export async function listCoursesByCreator(creatorId: string): Promise<Course[]> {
  return db
    .select()
    .from(courses)
    .where(eq(courses.creatorId, creatorId));
}

export async function listCoursesWithStatsByCreator(
  creatorId: string
): Promise<CreatorDashboardData> {
  const creatorCourses = await db
    .select()
    .from(courses)
    .where(eq(courses.creatorId, creatorId))
    .orderBy(desc(courses.createdAt));

  const creatorCourseIds = creatorCourses.map((c) => c.id);

  let publishedCount = 0;
  let draftCount = 0;

  const salesByCourseId: Record<string, number> =
    creatorCourseIds.length > 0 ? await countCourseSales(creatorCourseIds) : {};

  const coursesWithStats: CreatorCourseItem[] = await Promise.all(
    creatorCourses.map(async (course) => {
      const courseLessons = await listLessonsByCourse(course.id);
      const readiness = calculateCourseReadiness(course, courseLessons);

      if (course.isPublished) {
        publishedCount++;
      } else {
        draftCount++;
      }

      return {
        ...course,
        lessonCount: courseLessons.length,
        totalDurationSeconds: readiness.totalDurationSeconds,
        salesCount: salesByCourseId[course.id] ?? 0,
        readiness,
      };
    })
  );

  const { totalStudents, royaltiesCents } = creatorCourseIds.length
    ? await computeCreatorEngagement(creatorCourseIds)
    : { totalStudents: 0, royaltiesCents: 0 };

  return {
    courses: coursesWithStats,
    stats: {
      totalStudents,
      publishedCount,
      draftCount,
      royaltiesCents,
    },
  };
}

async function countCourseSales(
  courseIds: string[]
): Promise<Record<string, number>> {
  const rows = await db
    .select({ courseId: entitlements.courseId, recordCount: count() })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.source, "purchase"),
        isNull(entitlements.revokedAt),
        inArray(entitlements.courseId, courseIds)
      )
    )
    .groupBy(entitlements.courseId);

  return Object.fromEntries(
    rows.map((r) => [r.courseId as string, Number(r.recordCount)])
  );
}

async function computeCreatorEngagement(courseIds: string[]) {
  const rows = await db
    .select({
      userId: entitlements.userId,
      courseId: entitlements.courseId,
      source: entitlements.source,
      price: courses.priceCents,
    })
    .from(entitlements)
    .leftJoin(courses, eq(entitlements.courseId, courses.id))
    .where(
      and(
        isNull(entitlements.revokedAt),
        or(
          inArray(entitlements.courseId, courseIds),
          isNull(entitlements.courseId)
        )
      )
    );

  const studentSet = new Set<string>();
  let royaltiesCents = 0;

  for (const row of rows) {
    studentSet.add(row.userId);
    if (
      row.source === "purchase" &&
      row.courseId &&
      row.price !== null &&
      courseIds.includes(row.courseId)
    ) {
      royaltiesCents += row.price;
    }
  }

  return { totalStudents: studentSet.size, royaltiesCents };
}

export async function getLessonById(lessonId: string): Promise<Lesson | null> {
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);

  return lesson ?? null;
}

export async function getLessonBySlug(
  courseId: string,
  slug: string
): Promise<Lesson | null> {
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.courseId, courseId), eq(lessons.slug, slug)))
    .limit(1);

  return lesson ?? null;
}

export async function listLessonsByCourse(courseId: string): Promise<Lesson[]> {
  return db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.orderIndex));
}

export function calculateCourseReadiness(
  course: Course,
  lessonsList: Lesson[]
): CourseReadiness {
  const lessonCount = lessonsList.length;
  const totalDurationSeconds = lessonsList.reduce(
    (acc, l) => acc + (l.durationSeconds ?? 0),
    0
  );
  const isPurchaseEligible = course.isPublished && lessonCount >= 1;
  let status: CourseReadinessStatus = "draft";
  if (course.isPublished) {
    status = lessonCount >= 1 ? "ready" : "no_lessons";
  }

  return {
    isPublished: course.isPublished,
    isPurchaseEligible,
    status,
    lessonCount,
    totalDurationSeconds,
  };
}

export async function getCourseWithLessons(
  courseIdOrSlug: string
): Promise<CourseWithLessons | null> {
  const [row] = await db
    .select({
      course: courses,
      creatorName: user.name,
    })
    .from(courses)
    .leftJoin(user, eq(courses.creatorId, user.id))
    .where(or(eq(courses.id, courseIdOrSlug), eq(courses.slug, courseIdOrSlug)))
    .limit(1);

  if (!row) return null;

  const courseLessons = await listLessonsByCourse(row.course.id);
  const readiness = calculateCourseReadiness(row.course, courseLessons);

  return {
    ...row.course,
    creatorName: row.creatorName,
    lessons: courseLessons,
    readiness,
  };
}

export async function getCourseReadiness(
  courseId: string
): Promise<CourseReadiness | null> {
  const course = await getCourseById(courseId);
  if (!course) return null;

  const courseLessons = await listLessonsByCourse(courseId);
  return calculateCourseReadiness(course, courseLessons);
}
