"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth";
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

async function assertCreatorAuthorized(courseId: string): Promise<Course> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  const course = await getCourseById(courseId);
  if (!course) {
    throw new Error("Course not found");
  }

  if (course.creatorId !== session.user.id) {
    throw new Error("You are not authorized to edit this course");
  }

  return course;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

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
  try {
    const existing = await assertCreatorAuthorized(courseId);

    const priceCents = parsePriceDollarsToCents(input.priceDollars);
    if (priceCents < 1900 || priceCents > 19900) {
      return { success: false, error: "Price must be between $19 and $199" };
    }

    const updated = await updateCourse(courseId, {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || "Design",
      priceCents,
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      slug: input.slug?.trim() || undefined,
    });

    if (!updated) {
      return { success: false, error: "Failed to update course" };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath("/dashboard/courses");
    revalidatePath("/");
    if (existing.slug) revalidatePath(`/${existing.slug}`);
    if (updated.slug) revalidatePath(`/${updated.slug}`);

    return { success: true, data: updated };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update course",
    };
  }
}

export async function toggleCoursePublishAction(
  courseId: string,
  isPublished: boolean
): Promise<ActionResult<{ course: Course; readiness: ReturnType<typeof calculateCourseReadiness> }>> {
  try {
    const existing = await assertCreatorAuthorized(courseId);

    const updated = await setCoursePublishStatus(courseId, isPublished);
    if (!updated) {
      return { success: false, error: "Failed to update publication status" };
    }

    const courseLessons = await listLessonsByCourse(courseId);
    const readiness = calculateCourseReadiness(updated, courseLessons);

    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath("/dashboard/courses");
    revalidatePath("/");
    if (existing.slug) revalidatePath(`/${existing.slug}`);

    return { success: true, data: { course: updated, readiness } };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update publication status",
    };
  }
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
  try {
    const course = await assertCreatorAuthorized(courseId);

    const lesson = await createLesson({
      courseId,
      title: input.title.trim(),
      slug: input.slug?.trim() || undefined,
      description: input.description?.trim() || null,
      durationSeconds: input.durationSeconds ?? null,
      isPreview: input.isPreview ?? false,
    });

    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath("/dashboard/courses");
    revalidatePath("/");
    if (course.slug) revalidatePath(`/${course.slug}`);

    return { success: true, data: lesson };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create lesson",
    };
  }
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
  try {
    const course = await assertCreatorAuthorized(courseId);

    const updated = await updateLesson(
      lessonId,
      {
        title: input.title?.trim(),
        slug: input.slug?.trim() || undefined,
        description: input.description?.trim() || null,
        durationSeconds: input.durationSeconds ?? null,
        isPreview: input.isPreview,
      },
      course.id
    );

    if (!updated) {
      return { success: false, error: "Lesson not found in this course" };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath("/dashboard/courses");
    revalidatePath("/");
    if (course.slug) revalidatePath(`/${course.slug}`);

    return { success: true, data: updated };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update lesson",
    };
  }
}

export async function deleteLessonAction(
  courseId: string,
  lessonId: string
): Promise<ActionResult<void>> {
  try {
    const course = await assertCreatorAuthorized(courseId);

    const result = await deleteLesson(lessonId, course.id);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath("/dashboard/courses");
    revalidatePath("/");
    if (course.slug) revalidatePath(`/${course.slug}`);

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete lesson",
    };
  }
}

export async function reorderLessonsAction(
  courseId: string,
  lessonIds: string[]
): Promise<ActionResult<Lesson[]>> {
  try {
    const course = await assertCreatorAuthorized(courseId);

    const lessons = await reorderLessons(courseId, lessonIds);

    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath("/dashboard/courses");
    revalidatePath("/");
    if (course.slug) revalidatePath(`/${course.slug}`);

    return { success: true, data: lessons };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reorder lessons",
    };
  }
}

export async function getLessonVideoUploadUrlAction(
  courseId: string,
  lessonId: string,
  extension: SupportedVideoExtension
): Promise<ActionResult<UploadUrlResult>> {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("Authentication required");
    }

    const result = await getLessonVideoUploadUrl({
      userId: session.user.id,
      courseId,
      lessonId,
      extension,
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to get upload URL",
    };
  }
}

export async function saveLessonVideoAssetAction(
  courseId: string,
  lessonId: string,
  extension: SupportedVideoExtension,
  durationSeconds: number
): Promise<ActionResult<{ videoKey: string }>> {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("Authentication required");
    }

    const result = await saveLessonVideoAsset({
      userId: session.user.id,
      courseId,
      lessonId,
      extension,
      durationSeconds,
    });

    revalidatePath(`/dashboard/courses/${courseId}`);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save video asset",
    };
  }
}
