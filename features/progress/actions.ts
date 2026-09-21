"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lessons } from "@/lib/db/schema";
import { updateLessonProgress, setLessonCompletion } from "./mutations";
import { recordPlaybackSchema } from "./schemas";
import type { LessonProgress } from "./types";
import { safeAction, type ActionResult } from "@/lib/safe-action";

export type ProgressActionResult<T = unknown> = ActionResult<T>;

export async function recordLessonPlaybackAction(input: {
  courseId: string;
  lessonId: string;
  positionSeconds: number;
  ended?: boolean;
}): Promise<ProgressActionResult<LessonProgress>> {
  return safeAction({
    actionName: "recordLessonPlaybackAction",
    schema: recordPlaybackSchema,
    input,
    handler: async (validated, user) => {
      let position = validated.positionSeconds;

      if (validated.ended) {
        const [lesson] = await db
          .select({ durationSeconds: lessons.durationSeconds })
          .from(lessons)
          .where(
            and(
              eq(lessons.id, validated.lessonId),
              eq(lessons.courseId, validated.courseId)
            )
          )
          .limit(1);

        if (lesson?.durationSeconds && lesson.durationSeconds > 0) {
          position = lesson.durationSeconds;
        }
      }

      return await updateLessonProgress({
        userId: user.id,
        courseId: validated.courseId,
        lessonId: validated.lessonId,
        lastPositionSeconds: position,
      });
    },
  });
}

const toggleLessonCompletionInputSchema = z.object({
  courseId: z.string().trim().min(1, "Course ID is required"),
  lessonId: z.string().trim().min(1, "Lesson ID is required"),
  completed: z.boolean(),
});

export async function toggleLessonCompletionAction(input: {
  courseId: string;
  lessonId: string;
  completed: boolean;
}): Promise<ProgressActionResult<LessonProgress>> {
  return safeAction({
    actionName: "toggleLessonCompletionAction",
    schema: toggleLessonCompletionInputSchema,
    input,
    handler: async (validated, user) => {
      return await setLessonCompletion({
        userId: user.id,
        courseId: validated.courseId,
        lessonId: validated.lessonId,
        completed: validated.completed,
      });
    },
  });
}
