"use server";

import { and, eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db/db";
import { lessons } from "@/lib/db/schema";
import { updateLessonProgress, setLessonCompletion } from "./mutations";
import type { LessonProgress } from "./types";

export interface ProgressActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function recordLessonPlaybackAction(input: {
  courseId: string;
  lessonId: string;
  positionSeconds: number;
  ended?: boolean;
}): Promise<ProgressActionResult<LessonProgress>> {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    let position = input.positionSeconds;

    if (input.ended) {
      const [lesson] = await db
        .select({ durationSeconds: lessons.durationSeconds })
        .from(lessons)
        .where(
          and(
            eq(lessons.id, input.lessonId),
            eq(lessons.courseId, input.courseId)
          )
        )
        .limit(1);

      if (lesson?.durationSeconds && lesson.durationSeconds > 0) {
        position = lesson.durationSeconds;
      }
    }

    const progress = await updateLessonProgress({
      userId: session.user.id,
      courseId: input.courseId,
      lessonId: input.lessonId,
      lastPositionSeconds: position,
    });

    return { success: true, data: progress };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record playback",
    };
  }
}

export async function toggleLessonCompletionAction(input: {
  courseId: string;
  lessonId: string;
  completed: boolean;
}): Promise<ProgressActionResult<LessonProgress>> {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const progress = await setLessonCompletion({
      userId: session.user.id,
      courseId: input.courseId,
      lessonId: input.lessonId,
      completed: input.completed,
    });

    return { success: true, data: progress };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to toggle completion",
    };
  }
}
