import { z } from "zod";

export const signedPlaybackUrlSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  lessonSlug: z.string().min(1, "Lesson slug is required"),
  expiresInSeconds: z.number().int().positive().default(60),
});
