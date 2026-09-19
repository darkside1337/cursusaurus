import { z } from "zod";

export const supportedVideoExtensions = ["mp4", "webm", "mov"] as const;

export const getUploadUrlSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  lessonId: z.string().min(1, "Lesson ID is required"),
  extension: z.enum(supportedVideoExtensions),
});

export const saveLessonVideoSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  lessonId: z.string().min(1, "Lesson ID is required"),
  extension: z.enum(supportedVideoExtensions),
  durationSeconds: z.number().int().positive("Duration must be greater than 0"),
});

export const signedPlaybackUrlSchema = z.object({
  userId: z.string().min(1).optional(),
  courseId: z.string().min(1, "Course ID is required"),
  lessonId: z.string().min(1, "Lesson ID is required"),
  expiresInSeconds: z.number().int().positive().default(60),
});
