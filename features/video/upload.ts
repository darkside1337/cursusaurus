import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { courses, lessons } from "@/lib/db/schema";
import { getStorageClient } from "@/lib/storage";
import { getUploadUrlSchema, saveLessonVideoSchema } from "./schemas";
import {
  MAX_VIDEO_BYTES,
  VIDEO_BUCKET,
  type GetUploadUrlInput,
  type UploadUrlResult,
  type SaveLessonVideoInput,
} from "./types";

export async function getLessonVideoUploadUrl(
  input: GetUploadUrlInput
): Promise<UploadUrlResult> {
  const validated = getUploadUrlSchema.parse(input);

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, validated.courseId))
    .limit(1);

  if (!course || course.creatorId !== validated.userId) {
    throw new Error("Unauthorized or course not found");
  }

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, validated.lessonId), eq(lessons.courseId, validated.courseId)))
    .limit(1);

  if (!lesson) {
    throw new Error(`Lesson "${validated.lessonId}" not found in course "${validated.courseId}"`);
  }

  const storagePath = `${validated.courseId}/${validated.lessonId}.${validated.extension}`;
  const storage = getStorageClient();

  const { data, error } = await storage.storage
    .from(VIDEO_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate upload URL: ${error?.message || "Unknown error"}`);
  }

  return {
    uploadUrl: data.signedUrl,
    token: data.token,
    videoKey: storagePath,
  };
}

export async function saveLessonVideoAsset(
  input: SaveLessonVideoInput
): Promise<{ videoKey: string }> {
  const validated = saveLessonVideoSchema.parse(input);

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, validated.courseId))
    .limit(1);

  if (!course || course.creatorId !== validated.userId) {
    throw new Error("Unauthorized or course not found");
  }

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, validated.lessonId), eq(lessons.courseId, validated.courseId)))
    .limit(1);

  if (!lesson) {
    throw new Error(`Lesson "${validated.lessonId}" not found in course "${validated.courseId}"`);
  }

  // Server derives the canonical path itself — client cannot supply or choose arbitrary key
  const canonicalPath = `${validated.courseId}/${validated.lessonId}.${validated.extension}`;
  const storage = getStorageClient();

  // Verify object exists in Supabase Storage and check size
  const bucket = storage.storage.from(VIDEO_BUCKET);
  let objectSize = 0;

  if (typeof bucket.info === "function") {
    const { data: infoData, error: infoError } = await bucket.info(canonicalPath);
    if (infoError || !infoData) {
      throw new Error(`Video file does not exist in storage: ${canonicalPath}`);
    }
    const metadata = infoData as { size?: number; contentLength?: number };
    objectSize = metadata.size ?? metadata.contentLength ?? 0;
  } else if (typeof bucket.exists === "function") {
    const { data: existsData } = await bucket.exists(canonicalPath);
    if (!existsData) {
      throw new Error(`Video file does not exist in storage: ${canonicalPath}`);
    }
  }

  if (objectSize > MAX_VIDEO_BYTES) {
    throw new Error("Uploaded video exceeds maximum allowed size of 50 MB");
  }

  await db
    .update(lessons)
    .set({
      videoKey: canonicalPath,
      durationSeconds: validated.durationSeconds,
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, validated.lessonId));

  return { videoKey: canonicalPath };
}
