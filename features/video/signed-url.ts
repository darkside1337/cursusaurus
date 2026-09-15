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

  const allowed = await hasAccess(validated.userId, validated.courseId);
  if (!allowed) {
    throw new Error("Access denied: user does not hold an active entitlement for this course");
  }

  const storagePath = `${validated.courseId}/${validated.lessonSlug}.mp4`;
  const storage = getStorageClient();

  const { data, error } = await storage.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(storagePath, validated.expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed playback URL: ${error?.message || "Unknown error"}`);
  }

  const expiresAt = new Date(Date.now() + validated.expiresInSeconds * 1000);

  return {
    signedUrl: data.signedUrl,
    expiresAt,
  };
}
