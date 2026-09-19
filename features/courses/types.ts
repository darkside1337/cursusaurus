import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { courses, lessons } from "@/lib/db/schema";

export type Course = InferSelectModel<typeof courses>;
export type NewCourse = InferInsertModel<typeof courses>;

export type Lesson = InferSelectModel<typeof lessons>;
export type NewLesson = InferInsertModel<typeof lessons>;

export interface CreateCourseInput {
  title: string;
  description?: string | null;
  category?: string;
  thumbnailUrl?: string | null;
  priceCents: number;
  creatorId: string;
  slug?: string;
  isPublished?: boolean;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string | null;
  category?: string;
  thumbnailUrl?: string | null;
  priceCents?: number;
  slug?: string;
  isPublished?: boolean;
}

export interface CatalogCourseItem extends Course {
  creatorName?: string | null;
  lessonCount: number;
  totalDurationSeconds: number;
  readiness: CourseReadiness;
}

export interface CreateLessonInput {
  courseId: string;
  title: string;
  slug?: string;
  description?: string | null;
  durationSeconds?: number | null;
  isPreview?: boolean;
}

export interface UpdateLessonInput {
  title?: string;
  slug?: string;
  description?: string | null;
  durationSeconds?: number | null;
  isPreview?: boolean;
}

export interface ReorderLessonsInput {
  courseId: string;
  lessonIds: string[];
}

export type CourseReadinessStatus = "draft" | "no_lessons" | "ready";

export interface CourseReadiness {
  isPublished: boolean;
  isPurchaseEligible: boolean;
  status: CourseReadinessStatus;
  lessonCount: number;
  totalDurationSeconds: number;
}

export interface CourseWithLessons extends Course {
  lessons: Lesson[];
  readiness: CourseReadiness;
  creatorName?: string | null;
}

export interface CreatorCourseItem extends Course {
  lessonCount: number;
  totalDurationSeconds: number;
  salesCount: number;
  readiness: CourseReadiness;
}

export interface CreatorDashboardStats {
  totalStudents: number;
  publishedCount: number;
  draftCount: number;
  royaltiesCents: number;
}

export interface CreatorDashboardData {
  courses: CreatorCourseItem[];
  stats: CreatorDashboardStats;
}

