import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses } from "@/db/schema";
import type { Course } from "./types";

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

export async function listPublishedCourses(): Promise<Course[]> {
  return db
    .select()
    .from(courses)
    .where(eq(courses.isPublished, true));
}

export async function listCoursesByCreator(creatorId: string): Promise<Course[]> {
  return db
    .select()
    .from(courses)
    .where(eq(courses.creatorId, creatorId));
}
