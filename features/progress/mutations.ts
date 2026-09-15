import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonProgress } from "@/db/schema";
import { updateProgressSchema } from "./schemas";
import type { UpdateProgressInput, LessonProgress } from "./types";

/**
 * Updates or creates lesson playback progress.
 * Invariant #6: Progress rows are never deleted on refund.
 */
export async function updateLessonProgress(
  input: UpdateProgressInput
): Promise<LessonProgress> {
  const validated = updateProgressSchema.parse(input);

  const [existing] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, validated.userId),
        eq(lessonProgress.courseId, validated.courseId),
        eq(lessonProgress.lessonSlug, validated.lessonSlug)
      )
    )
    .limit(1);

  if (existing) {
    const updateValues: Partial<typeof lessonProgress.$inferInsert> = {};
    if (validated.completed !== undefined) {
      updateValues.completed = validated.completed;
    }
    if (validated.lastPositionSeconds !== undefined) {
      updateValues.lastPositionSeconds = validated.lastPositionSeconds;
    }

    const [updated] = await db
      .update(lessonProgress)
      .set(updateValues)
      .where(eq(lessonProgress.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(lessonProgress)
    .values({
      id: crypto.randomUUID(),
      userId: validated.userId,
      courseId: validated.courseId,
      lessonSlug: validated.lessonSlug,
      completed: validated.completed ?? false,
      lastPositionSeconds: validated.lastPositionSeconds ?? 0,
    })
    .returning();

  return created;
}
