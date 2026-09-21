"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth";
import { ActionError } from "@/lib/action-errors";
import { safeAction, type ActionResult } from "@/lib/safe-action";
import { httpsUrlSchema } from "@/features/courses/schemas";
import {
  getCourseById,
  updateCourse,
  setCoursePublishStatus,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  listLessonsByCourse,
  calculateCourseReadiness,
} from "@/features/courses";
import type { Lesson, Course } from "@/features/courses";
import { parsePriceDollarsToCents } from "@/lib/format-price";
import {
  getLessonVideoUploadUrl,
  saveLessonVideoAsset,
  type SupportedVideoExtension,
  type UploadUrlResult,
} from "@/features/video";

export type { ActionResult };

async function assertCreatorAuthorized(courseId: string): Promise<Course> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new ActionError("Authentication required");
  }

  const course = await getCourseById(courseId);
  if (!course) {
    throw new ActionError("Course not found");
  }

  if (course.creatorId !== session.user.id) {
    throw new ActionError("You are not authorized to edit this course");
  }

  return course;
}

const updateCourseMetadataInputSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().trim().max(4000, "Description must be 4000 characters or fewer").optional().nullable(),
  category: z.string().trim().min(1).max(50).optional(),
  priceDollars: z.number().finite("Price must be a valid number").min(0, "Price cannot be negative"),
  thumbnailUrl: httpsUrlSchema.optional().nullable(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
});

export async function updateCourseMetadataAction(
  courseId: string,
  input: {
    title: string;
    description?: string | null;
    category?: string;
    priceDollars: number;
    thumbnailUrl?: string | null;
    slug?: string;
  }
): Promise<ActionResult<Course>> {
  return safeAction({
    actionName: "updateCourseMetadataAction",
    schema: updateCourseMetadataInputSchema,
    input,
    handler: async (validatedInput) => {
      const existing = await assertCreatorAuthorized(courseId);

      const priceCents = parsePriceDollarsToCents(validatedInput.priceDollars);
      if (priceCents < 1900 || priceCents > 19900) {
        throw new ActionError("Price must be between $19 and $199");
      }

      const updated = await updateCourse(courseId, {
        title: validatedInput.title.trim(),
        description: validatedInput.description?.trim() || null,
        category: validatedInput.category?.trim() || "Design",
        priceCents,
        thumbnailUrl: validatedInput.thumbnailUrl?.trim() || null,
        slug: validatedInput.slug?.trim() || undefined,
      });

      if (!updated) {
        throw new ActionError("Failed to update course");
      }

      revalidatePath(`/dashboard/courses/${courseId}`);
      revalidatePath("/dashboard/courses");
      revalidatePath("/");
      if (existing.slug) revalidatePath(`/${existing.slug}`);
      if (updated.slug) revalidatePath(`/${updated.slug}`);

      return updated;
    },
  });
}

export async function toggleCoursePublishAction(
  courseId: string,
  isPublished: boolean
): Promise<ActionResult<{ course: Course; readiness: ReturnType<typeof calculateCourseReadiness> }>> {
  return safeAction({
    actionName: "toggleCoursePublishAction",
    schema: z.object({
      courseId: z.string().min(1, "Course ID is required"),
      isPublished: z.boolean(),
    }),
    input: { courseId, isPublished },
    handler: async (validated) => {
      const existing = await assertCreatorAuthorized(validated.courseId);

      const updated = await setCoursePublishStatus(validated.courseId, validated.isPublished);
      if (!updated) {
        throw new ActionError("Failed to update publication status");
      }

      const courseLessons = await listLessonsByCourse(validated.courseId);
      const readiness = calculateCourseReadiness(updated, courseLessons);

      revalidatePath(`/dashboard/courses/${validated.courseId}`);
      revalidatePath("/dashboard/courses");
      revalidatePath("/");
      if (existing.slug) revalidatePath(`/${existing.slug}`);

      return { course: updated, readiness };
    },
  });
}

export async function createLessonAction(
  courseId: string,
  input: {
    title: string;
    slug?: string;
    description?: string | null;
    durationSeconds?: number | null;
    isPreview?: boolean;
  }
): Promise<ActionResult<Lesson>> {
  return safeAction({
    actionName: "createLessonAction",
    schema: z.object({
      title: z.string().trim().min(2, "Title must be at least 2 characters").max(120),
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
        .optional(),
      description: z.string().trim().max(2000).optional().nullable(),
      durationSeconds: z.number().int().min(0).optional().nullable(),
      isPreview: z.boolean().optional(),
    }),
    input,
    handler: async (validatedInput) => {
      const course = await assertCreatorAuthorized(courseId);

      const lesson = await createLesson({
        courseId,
        title: validatedInput.title.trim(),
        slug: validatedInput.slug?.trim() || undefined,
        description: validatedInput.description?.trim() || null,
        durationSeconds: validatedInput.durationSeconds ?? null,
        isPreview: validatedInput.isPreview ?? false,
      });

      revalidatePath(`/dashboard/courses/${courseId}`);
      revalidatePath("/dashboard/courses");
      revalidatePath("/");
      if (course.slug) revalidatePath(`/${course.slug}`);

      return lesson;
    },
  });
}

export async function updateLessonAction(
  courseId: string,
  lessonId: string,
  input: {
    title?: string;
    slug?: string;
    description?: string | null;
    durationSeconds?: number | null;
    isPreview?: boolean;
  }
): Promise<ActionResult<Lesson>> {
  return safeAction({
    actionName: "updateLessonAction",
    schema: z.object({
      title: z.string().trim().min(2, "Title must be at least 2 characters").max(120).optional(),
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
        .optional(),
      description: z.string().trim().max(2000).optional().nullable(),
      durationSeconds: z.number().int().min(0).optional().nullable(),
      isPreview: z.boolean().optional(),
    }),
    input,
    handler: async (validatedInput) => {
      const course = await assertCreatorAuthorized(courseId);

      const updated = await updateLesson(
        lessonId,
        {
          title: validatedInput.title?.trim(),
          slug: validatedInput.slug?.trim() || undefined,
          description: validatedInput.description?.trim() || null,
          durationSeconds: validatedInput.durationSeconds ?? null,
          isPreview: validatedInput.isPreview,
        },
        course.id
      );

      if (!updated) {
        throw new ActionError("Lesson not found in this course");
      }

      revalidatePath(`/dashboard/courses/${courseId}`);
      revalidatePath("/dashboard/courses");
      revalidatePath("/");
      if (course.slug) revalidatePath(`/${course.slug}`);

      return updated;
    },
  });
}

export async function deleteLessonAction(
  courseId: string,
  lessonId: string
): Promise<ActionResult<void>> {
  return safeAction({
    actionName: "deleteLessonAction",
    schema: z.object({
      courseId: z.string().min(1, "Course ID is required"),
      lessonId: z.string().min(1, "Lesson ID is required"),
    }),
    input: { courseId, lessonId },
    handler: async (validated) => {
      const course = await assertCreatorAuthorized(validated.courseId);

      const result = await deleteLesson(validated.lessonId, course.id);
      if (!result.success) {
        throw new ActionError(result.error || "Failed to delete lesson");
      }

      revalidatePath(`/dashboard/courses/${validated.courseId}`);
      revalidatePath("/dashboard/courses");
      revalidatePath("/");
      if (course.slug) revalidatePath(`/${course.slug}`);
    },
  });
}

export async function reorderLessonsAction(
  courseId: string,
  lessonIds: string[]
): Promise<ActionResult<Lesson[]>> {
  return safeAction({
    actionName: "reorderLessonsAction",
    schema: z.object({
      courseId: z.string().min(1, "Course ID is required"),
      lessonIds: z
        .array(z.string().trim().min(1))
        .min(1, "At least one lesson ID is required")
        .max(200, "Cannot reorder more than 200 lessons at once"),
    }),
    input: { courseId, lessonIds },
    handler: async (validated) => {
      const course = await assertCreatorAuthorized(validated.courseId);

      const lessons = await reorderLessons(validated.courseId, validated.lessonIds);

      revalidatePath(`/dashboard/courses/${validated.courseId}`);
      revalidatePath("/dashboard/courses");
      revalidatePath("/");
      if (course.slug) revalidatePath(`/${course.slug}`);

      return lessons;
    },
  });
}

export async function getLessonVideoUploadUrlAction(
  courseId: string,
  lessonId: string,
  extension: SupportedVideoExtension
): Promise<ActionResult<UploadUrlResult>> {
  return safeAction({
    actionName: "getLessonVideoUploadUrlAction",
    schema: z.object({
      courseId: z.string().min(1, "Course ID is required"),
      lessonId: z.string().min(1, "Lesson ID is required"),
      extension: z.enum(["mp4", "webm", "mov"] as const),
    }),
    input: { courseId, lessonId, extension },
    handler: async (validated, user) => {
      await assertCreatorAuthorized(validated.courseId);

      return await getLessonVideoUploadUrl({
        userId: user.id,
        courseId: validated.courseId,
        lessonId: validated.lessonId,
        extension: validated.extension,
      });
    },
  });
}

export async function saveLessonVideoAssetAction(
  courseId: string,
  lessonId: string,
  extension: SupportedVideoExtension,
  durationSeconds: number
): Promise<ActionResult<{ videoKey: string }>> {
  return safeAction({
    actionName: "saveLessonVideoAssetAction",
    schema: z.object({
      courseId: z.string().min(1, "Course ID is required"),
      lessonId: z.string().min(1, "Lesson ID is required"),
      extension: z.enum(["mp4", "webm", "mov"] as const),
      durationSeconds: z.number().int().positive("Duration must be greater than 0"),
    }),
    input: { courseId, lessonId, extension, durationSeconds },
    handler: async (validated, user) => {
      await assertCreatorAuthorized(validated.courseId);

      const result = await saveLessonVideoAsset({
        userId: user.id,
        courseId: validated.courseId,
        lessonId: validated.lessonId,
        extension: validated.extension,
        durationSeconds: validated.durationSeconds,
      });

      revalidatePath(`/dashboard/courses/${validated.courseId}`);
      return result;
    },
  });
}
