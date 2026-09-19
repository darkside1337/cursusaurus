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
