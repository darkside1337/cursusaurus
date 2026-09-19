import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lessons, lessonProgress } from "@/lib/db/schema";
import { getLessonProgressSchema } from "./schemas";
import type { LessonProgress, CourseProgressSummary } from "./types";

export async function getLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string
): Promise<LessonProgress | null> {
  const validated = getLessonProgressSchema.parse({ userId, courseId, lessonId });

  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, validated.userId),
        eq(lessonProgress.courseId, validated.courseId),
        eq(lessonProgress.lessonId, validated.lessonId)
      )
    )
    .limit(1);

  return progress ?? null;
}

export async function getCourseProgress(
  userId: string,
  courseId: string
): Promise<CourseProgressSummary> {
  // Total lessons in course from lessons table (denominator)
  const courseLessons = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.courseId, courseId));

  const totalLessonsCount = courseLessons.length;

  const records = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.courseId, courseId)
      )
    );

  const completedLessonsCount = records.filter((r) => r.completed).length;
  const percentage =
    totalLessonsCount === 0
      ? 0
      : Math.round((completedLessonsCount / totalLessonsCount) * 100);

  const lessonsMap: Record<string, LessonProgress> = {};
  for (const record of records) {
    lessonsMap[record.lessonId] = record;
  }

  return {
    courseId,
    totalLessonsCount,
    completedLessonsCount,
    percentage,
    lessons: lessonsMap,
  };
}
