import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { courses, lessons, lessonProgress } from "@/lib/db/schema";
import { hasAccess } from "@/features/entitlements/access";
import { updateProgressSchema, setCompletionSchema } from "./schemas";
import type { UpdateProgressInput, SetCompletionInput, LessonProgress } from "./types";

/**
 * Updates or creates lesson playback progress.
 *
 * Invariant #6: Progress rows are never deleted on refund or cancellation.
 * Sticky completion: Once marked completed, playback position scrubbing does not unset completed.
 * Auto-completion: Auto-completes when duration is positive and position reaches 90% (Math.ceil).
 */
export async function updateLessonProgress(
  input: UpdateProgressInput
): Promise<LessonProgress> {
  const validated = updateProgressSchema.parse(input);

  // Course and lesson lookups are independent — fetch in parallel
  const [[course], [lesson]] = await Promise.all([
    db
      .select()
      .from(courses)
      .where(eq(courses.id, validated.courseId))
      .limit(1),
    db
      .select()
      .from(lessons)
      .where(
        and(
          eq(lessons.id, validated.lessonId),
          eq(lessons.courseId, validated.courseId)
        )
      )
      .limit(1),
  ]);

  if (!course) {
    throw new Error(`Course "${validated.courseId}" not found`);
  }

  if (!lesson) {
    throw new Error(
      `Cannot record progress for unknown lesson "${validated.lessonId}" in course "${validated.courseId}"`
    );
  }

  // Authorization check + existing progress fetch are independent — run in parallel
  const isCreator = validated.userId === course.creatorId;
  const [[existing], isAllowed] = await Promise.all([
    db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, validated.userId),
          eq(lessonProgress.lessonId, validated.lessonId)
        )
      )
      .limit(1),
    isCreator ? Promise.resolve(true) : hasAccess(validated.userId, validated.courseId),
  ]);

  if (!isAllowed) {
    throw new Error(
      "Access denied: user does not hold an active entitlement for this course"
    );
  }

  // Clamp position:
  // If duration is known and positive: [0, durationSeconds]
  // Otherwise: [0, infinity)
  const raw = validated.lastPositionSeconds ?? 0;
  const clampedPosition =
    lesson.durationSeconds != null && lesson.durationSeconds > 0
      ? Math.max(0, Math.min(raw, lesson.durationSeconds))
      : Math.max(0, raw);

  // Auto-complete check: only if duration is positive and position reaches 90%
  const autoCompleteCondition =
    lesson.durationSeconds != null &&
    lesson.durationSeconds > 0 &&
    clampedPosition > 0 &&
    clampedPosition >= Math.ceil(lesson.durationSeconds * 0.9);

  const shouldBeCompleted = existing?.completed === true || autoCompleteCondition;

  const [progress] = await db
    .insert(lessonProgress)
    .values({
      id: crypto.randomUUID(),
      userId: validated.userId,
      courseId: validated.courseId,
      lessonId: validated.lessonId,
      lastPositionSeconds: clampedPosition,
      completed: shouldBeCompleted,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        lastPositionSeconds: clampedPosition,
        completed: shouldBeCompleted,
        updatedAt: new Date(),
      },
    })
    .returning();

  return progress;
}

/**
 * Explicitly toggles lesson completion status.
 * This is the ONLY entry point capable of transitioning completed: true -> false.
 */
export async function setLessonCompletion(
  input: SetCompletionInput
): Promise<LessonProgress> {
  const validated = setCompletionSchema.parse(input);

  // Course and lesson lookups are independent — fetch in parallel
  const [[course], [lesson]] = await Promise.all([
    db
      .select()
      .from(courses)
      .where(eq(courses.id, validated.courseId))
      .limit(1),
    db
      .select()
      .from(lessons)
      .where(
        and(
          eq(lessons.id, validated.lessonId),
          eq(lessons.courseId, validated.courseId)
        )
      )
      .limit(1),
  ]);

  if (!course) {
    throw new Error(`Course "${validated.courseId}" not found`);
  }

  if (!lesson) {
    throw new Error(
      `Cannot update completion for unknown lesson "${validated.lessonId}" in course "${validated.courseId}"`
    );
  }

  // Authorization check + existing progress fetch are independent — run in parallel
  const isCreator = validated.userId === course.creatorId;
  const [[existing], isAllowed] = await Promise.all([
    db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, validated.userId),
          eq(lessonProgress.lessonId, validated.lessonId)
        )
      )
      .limit(1),
    isCreator ? Promise.resolve(true) : hasAccess(validated.userId, validated.courseId),
  ]);

  if (!isAllowed) {
    throw new Error(
      "Access denied: user does not hold an active entitlement for this course"
    );
  }

  const lastPosition = existing?.lastPositionSeconds ?? 0;

  const [progress] = await db
    .insert(lessonProgress)
    .values({
      id: crypto.randomUUID(),
      userId: validated.userId,
      courseId: validated.courseId,
      lessonId: validated.lessonId,
      lastPositionSeconds: lastPosition,
      completed: validated.completed,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        completed: validated.completed,
        updatedAt: new Date(),
      },
    })
    .returning();

  return progress;
}
