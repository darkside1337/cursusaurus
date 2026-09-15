import { z } from "zod";

// Per PRD §8: $19–$199 pricing range enforced server-side
export const coursePriceCentsSchema = z
  .number()
  .int("Price must be an integer in cents")
  .min(1900, "Minimum course price is $19 (1900 cents)")
  .max(19900, "Maximum course price is $199 (19900 cents)");

export const createCourseSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  priceCents: coursePriceCentsSchema,
  creatorId: z.string().min(1, "Creator ID is required"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  isPublished: z.boolean().optional(),
});

export const updateCourseSchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  priceCents: coursePriceCentsSchema.optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  isPublished: z.boolean().optional(),
});

export const courseSlugParamSchema = z.object({
  slug: z.string().trim().min(1, "Course slug is required"),
});

export const courseIdParamSchema = z.object({
  courseId: z.string().trim().min(1, "Course ID is required"),
});
