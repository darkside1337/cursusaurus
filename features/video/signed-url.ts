import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { courses, lessons } from "@/lib/db/schema";
import { getStorageClient } from "@/lib/storage";
import { hasAccess } from "@/features/entitlements/access";
import { signedPlaybackUrlSchema } from "./schemas";
import type { SignedPlaybackUrlInput, SignedPlaybackUrlResult } from "./types";

const VIDEO_BUCKET = "course-videos";

/**
 * Issues a short-lived signed playback URL for a course lesson video.
 *
 * INVARIANT #9: Video signed URLs are only issued server-side after hasAccess() returns true.
 * No client ever receives a raw storage path or long-lived URL.
 */
export async function getSignedPlaybackUrl(
  input: SignedPlaybackUrlInput
): Promise<SignedPlaybackUrlResult> {
  const validated = signedPlaybackUrlSchema.parse(input);

  // 1. Query course and lesson by courseId and lessonId
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, validated.courseId))
    .limit(1);

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(
      and(
        eq(lessons.id, validated.lessonId),
        eq(lessons.courseId, validated.courseId)
      )
    )
    .limit(1);

  if (!course || !lesson) {
    return { status: "not_found" };
  }

  // 2. Anti-enumeration: unpublished courses requested by non-creator return not_found
  if (!course.isPublished && validated.userId !== course.creatorId) {
    return { status: "not_found" };
  }

  // 3. Authorization check
  if (!lesson.isPreview) {
    if (!validated.userId) {
      return { status: "unauthenticated" };
    }

    if (validated.userId !== course.creatorId) {
      const allowed = await hasAccess(validated.userId, course.id);
      if (!allowed) {
        return { status: "forbidden" };
      }
    }
  }

  // 4. Check video presence
  if (!lesson.videoKey) {
    return { status: "no_video" };
  }

  // 5. Mint signed URL from Supabase Storage
  const storage = getStorageClient();
  const { data, error } = await storage.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(lesson.videoKey, validated.expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to generate signed playback URL: ${error?.message || "Unknown error"}`
    );
  }

  const expiresAt = new Date(Date.now() + validated.expiresInSeconds * 1000);

  return {
    status: "ok",
    signedUrl: data.signedUrl,
    expiresAt,
  };
}
