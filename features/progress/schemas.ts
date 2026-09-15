import { z } from "zod";

export const updateProgressSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  lessonSlug: z.string().min(1, "Lesson slug is required"),
  completed: z.boolean().optional(),
  lastPositionSeconds: z.number().int().min(0).optional(),
});

export const getLessonProgressSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  lessonSlug: z.string().min(1, "Lesson slug is required"),
});
