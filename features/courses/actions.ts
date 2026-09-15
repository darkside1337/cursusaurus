import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses } from "@/db/schema";
import { createCourseSchema, updateCourseSchema } from "./schemas";
import { generateSlug } from "./slug";
import type { Course, CreateCourseInput, UpdateCourseInput } from "./types";

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const validated = createCourseSchema.parse(input);
  const id = crypto.randomUUID();
  const slug = validated.slug || generateSlug(validated.title);

  const [course] = await db
    .insert(courses)
    .values({
      id,
      title: validated.title,
      slug,
      description: validated.description ?? null,
      priceCents: validated.priceCents,
      creatorId: validated.creatorId,
      isPublished: validated.isPublished ?? false,
    })
    .returning();

  return course;
}

export async function updateCourse(
  courseId: string,
  input: UpdateCourseInput
): Promise<Course | null> {
  const validated = updateCourseSchema.parse(input);

  const updateValues: Partial<typeof courses.$inferInsert> = {};
  if (validated.title !== undefined) updateValues.title = validated.title;
  if (validated.description !== undefined) updateValues.description = validated.description;
  if (validated.priceCents !== undefined) updateValues.priceCents = validated.priceCents;
  if (validated.isPublished !== undefined) updateValues.isPublished = validated.isPublished;
  if (validated.slug !== undefined) {
    updateValues.slug = validated.slug;
  } else if (validated.title !== undefined) {
    updateValues.slug = generateSlug(validated.title);
  }

  const [course] = await db
    .update(courses)
    .set(updateValues)
    .where(eq(courses.id, courseId))
    .returning();

  return course ?? null;
}

export async function setCoursePublishStatus(
  courseId: string,
  isPublished: boolean
): Promise<Course | null> {
  const [course] = await db
    .update(courses)
    .set({ isPublished })
    .where(eq(courses.id, courseId))
    .returning();

  return course ?? null;
}
