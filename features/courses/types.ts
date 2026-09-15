import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { courses } from "@/db/schema";

export type Course = InferSelectModel<typeof courses>;
export type NewCourse = InferInsertModel<typeof courses>;

export interface CreateCourseInput {
  title: string;
  description?: string | null;
  priceCents: number;
  creatorId: string;
  slug?: string;
  isPublished?: boolean;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string | null;
  priceCents?: number;
  slug?: string;
  isPublished?: boolean;
}
