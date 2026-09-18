import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, lessons, lessonProgress } from "@/db/schema";
import {
  createCourseSchema,
  updateCourseSchema,
  createLessonSchema,
  updateLessonSchema,
  reorderLessonsSchema,
} from "./schemas";
import { generateSlug } from "./slug";
import { listLessonsByCourse } from "./queries";
import type {
  Course,
  CreateCourseInput,
  UpdateCourseInput,
  Lesson,
  CreateLessonInput,
  UpdateLessonInput,
} from "./types";

async function resolveUniqueCourseSlug(
  baseSlug: string,
  excludeCourseId?: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, slug))
      .limit(1);

    if (!existing || (excludeCourseId && existing.id === excludeCourseId)) {
      return slug;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function resolveUniqueLessonSlug(
  courseId: string,
  baseSlug: string,
  excludeLessonId?: string,
  client: DbOrTx = db
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const [existing] = await client
      .select({ id: lessons.id })
      .from(lessons)
      .where(and(eq(lessons.courseId, courseId), eq(lessons.slug, slug)))
      .limit(1);

    if (!existing || (excludeLessonId && existing.id === excludeLessonId)) {
      return slug;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const validated = createCourseSchema.parse(input);
  const id = crypto.randomUUID();
  const rawSlug = validated.slug || generateSlug(validated.title);
  const slug = await resolveUniqueCourseSlug(rawSlug);

  const [course] = await db
    .insert(courses)
    .values({
      id,
      title: validated.title,
      slug,
      description: validated.description ?? null,
      category: validated.category ?? "Design",
      thumbnailUrl: validated.thumbnailUrl ?? null,
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
  if (validated.category !== undefined) updateValues.category = validated.category;
  if (validated.thumbnailUrl !== undefined) updateValues.thumbnailUrl = validated.thumbnailUrl;
  if (validated.priceCents !== undefined) updateValues.priceCents = validated.priceCents;
  if (validated.isPublished !== undefined) updateValues.isPublished = validated.isPublished;

  if (validated.slug !== undefined) {
    updateValues.slug = await resolveUniqueCourseSlug(validated.slug, courseId);
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

export async function publishCourse(courseId: string): Promise<Course | null> {
  return setCoursePublishStatus(courseId, true);
}

export async function unpublishCourse(courseId: string): Promise<Course | null> {
  return setCoursePublishStatus(courseId, false);
}

export async function createLesson(input: CreateLessonInput): Promise<Lesson> {
  const validated = createLessonSchema.parse(input);

  return await db.transaction(async (tx) => {
    // Acquire row-level lock on parent course to serialize concurrent lesson creation
    await tx
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, validated.courseId))
      .for("update");

    // Compute next orderIndex within the lock
    const [latestLesson] = await tx
      .select({ orderIndex: lessons.orderIndex })
      .from(lessons)
      .where(eq(lessons.courseId, validated.courseId))
      .orderBy(desc(lessons.orderIndex))
      .limit(1);

    const orderIndex = latestLesson ? latestLesson.orderIndex + 1 : 0;
    const rawSlug = validated.slug || generateSlug(validated.title);
    const slug = await resolveUniqueLessonSlug(validated.courseId, rawSlug, undefined, tx);
    const id = crypto.randomUUID();

    const [lesson] = await tx
      .insert(lessons)
      .values({
        id,
        courseId: validated.courseId,
        title: validated.title,
        slug,
        description: validated.description ?? null,
        orderIndex,
        durationSeconds: validated.durationSeconds ?? null,
        isPreview: validated.isPreview ?? false,
      })
      .returning();

    return lesson;
  });
}

export async function updateLesson(
  lessonId: string,
  input: UpdateLessonInput,
  expectedCourseId?: string
): Promise<Lesson | null> {
  const validated = updateLessonSchema.parse(input);

  const [existing] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);

  if (!existing) return null;
  if (expectedCourseId && existing.courseId !== expectedCourseId) {
    return null;
  }

  const updateValues: Partial<typeof lessons.$inferInsert> = {};
  if (validated.title !== undefined) updateValues.title = validated.title;
  if (validated.description !== undefined) updateValues.description = validated.description;
  if (validated.durationSeconds !== undefined) updateValues.durationSeconds = validated.durationSeconds;
  if (validated.isPreview !== undefined) updateValues.isPreview = validated.isPreview;

  if (validated.slug !== undefined) {
    updateValues.slug = await resolveUniqueLessonSlug(
      existing.courseId,
      validated.slug,
      lessonId
    );
  }

  const [updated] = await db
    .update(lessons)
    .set(updateValues)
    .where(eq(lessons.id, lessonId))
    .returning();

  return updated ?? null;
}

export async function deleteLesson(
  lessonId: string,
  expectedCourseId?: string
): Promise<{ success: boolean; error?: string }> {
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);

  if (!lesson) {
    return { success: false, error: "Lesson not found" };
  }

  if (expectedCourseId && lesson.courseId !== expectedCourseId) {
    return {
      success: false,
      error: "Lesson does not belong to the specified course",
    };
  }

  // Invariant check: protect learner progress
  const [hasProgress] = await db
    .select({ id: lessonProgress.id })
    .from(lessonProgress)
    .where(eq(lessonProgress.lessonId, lessonId))
    .limit(1);

  if (hasProgress) {
    return {
      success: false,
      error:
        "Cannot delete lesson with existing learner progress; unpublish or modify the course instead",
    };
  }

  await db.transaction(async (tx) => {
    await tx.delete(lessons).where(eq(lessons.id, lessonId));

    // Re-compact orderIndex for remaining lessons in course
    const remaining = await tx
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, lesson.courseId))
      .orderBy(lessons.orderIndex);

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].orderIndex !== i) {
        await tx
          .update(lessons)
          .set({ orderIndex: i })
          .where(eq(lessons.id, remaining[i].id));
      }
    }
  });

  return { success: true };
}

export async function reorderLessons(
  courseId: string,
  lessonIds: string[]
): Promise<Lesson[]> {
  const validated = reorderLessonsSchema.parse({ courseId, lessonIds });

  const existingLessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, validated.courseId));

  const existingIds = new Set(existingLessons.map((l) => l.id));
  const uniqueInputIds = new Set(validated.lessonIds);

  if (
    validated.lessonIds.length !== existingLessons.length ||
    uniqueInputIds.size !== existingLessons.length ||
    !validated.lessonIds.every((id) => existingIds.has(id))
  ) {
    throw new Error(
      "reorderLessons requires an array matching all existing lesson IDs for the course"
    );
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < validated.lessonIds.length; i++) {
      await tx
        .update(lessons)
        .set({ orderIndex: i })
        .where(eq(lessons.id, validated.lessonIds[i]));
    }
  });

  return listLessonsByCourse(validated.courseId);
}
