import { z } from "zod";

export const recordPlaybackSchema = z.object({
  courseId: z.string().trim().min(1, "Course ID is required"),
  lessonId: z.string().trim().min(1, "Lesson ID is required"),
  positionSeconds: z
    .number()
    .finite("Position must be a finite number")
    .int("Position must be an integer")
    .min(0, "Position cannot be negative"),
  ended: z.boolean().optional(),
});

export const updateProgressSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  lessonId: z.string().min(1, "Lesson ID is required"),
  lastPositionSeconds: z
    .number()
    .finite("Position must be a finite number")
    .int("Position must be an integer")
    .optional(),
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
