import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lessonProgress } from "@/lib/db/schema";
import { getLessonProgressSchema } from "./schemas";
import type { LessonProgress, CourseProgressSummary } from "./types";

export async function getLessonProgress(
  userId: string,
  courseId: string,
  lessonSlug: string
): Promise<LessonProgress | null> {
  const validated = getLessonProgressSchema.parse({ userId, courseId, lessonSlug });

  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, validated.userId),
        eq(lessonProgress.courseId, validated.courseId),
        eq(lessonProgress.lessonSlug, validated.lessonSlug)
      )
    )
    .limit(1);

  return progress ?? null;
}

export async function getCourseProgress(
  userId: string,
  courseId: string
): Promise<CourseProgressSummary> {
  const records = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.courseId, courseId)
      )
    );

  const totalLessonsCompleted = records.filter((r) => r.completed).length;

  return {
    courseId,
    totalLessonsCompleted,
    lessons: records,
  };
}
