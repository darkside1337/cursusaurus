import { z } from "zod";

export const updateProgressSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  lessonId: z.string().min(1, "Lesson ID is required"),
  lastPositionSeconds: z.number().int().optional(),
});

export const setCompletionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  lessonId: z.string().min(1, "Lesson ID is required"),
  completed: z.boolean(),
});

export const getLessonProgressSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  lessonId: z.string().min(1, "Lesson ID is required"),
});
