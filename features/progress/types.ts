import type { InferSelectModel } from "drizzle-orm";
import { lessonProgress } from "@/lib/db/schema";

export type LessonProgress = InferSelectModel<typeof lessonProgress>;

export interface UpdateProgressInput {
  userId: string;
  courseId: string;
  lessonId: string;
  lastPositionSeconds?: number;
}

export interface SetCompletionInput {
  userId: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
}

export interface CourseProgressSummary {
  courseId: string;
  totalLessonsCount: number;
  completedLessonsCount: number;
  percentage: number;
  lessons: Record<string, LessonProgress>;
}

// ---------------------------------------------------------------------------
// Optimistic-update helpers
// ---------------------------------------------------------------------------

/**
 * Returns a stub LessonProgress for use in optimistic updates when no real
 * progress record exists yet for the given lesson.
 */
export function emptyLessonProgress(
  courseId: string,
  lessonId: string
): LessonProgress {
  return {
    id: "",
    userId: "",
    courseId,
    lessonId,
    completed: false,
    lastPositionSeconds: 0,
    updatedAt: new Date(),
  };
}

/**
 * Pure reducer for optimistic progress mutations. Applies `patch` to the
 * lesson identified by `lessonId`, then recomputes aggregate counts.
 */
export function applyLessonCompletion(
  prev: CourseProgressSummary,
  courseId: string,
  lessonId: string,
  patch: Partial<LessonProgress>
): CourseProgressSummary {
  const existing = prev.lessons[lessonId];
  const nextLessons: Record<string, LessonProgress> = {
    ...prev.lessons,
    [lessonId]: { ...(existing ?? emptyLessonProgress(courseId, lessonId)), ...patch },
  };
  const completedCount = Object.values(nextLessons).filter((l) => l.completed).length;
  return {
    ...prev,
    lessons: nextLessons,
    completedLessonsCount: completedCount,
    percentage:
      prev.totalLessonsCount > 0
        ? Math.round((completedCount / prev.totalLessonsCount) * 100)
        : 0,
  };
}
