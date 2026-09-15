import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { lessonProgress } from "@/db/schema";

export type LessonProgress = InferSelectModel<typeof lessonProgress>;
export type NewLessonProgress = InferInsertModel<typeof lessonProgress>;

export interface UpdateProgressInput {
  userId: string;
  courseId: string;
  lessonSlug: string;
  completed?: boolean;
  lastPositionSeconds?: number;
}

export interface CourseProgressSummary {
  courseId: string;
  totalLessonsCompleted: number;
  lessons: LessonProgress[];
}
