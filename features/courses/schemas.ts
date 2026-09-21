import { z } from "zod";

// Per PRD §8: $19–$199 pricing range enforced server-side
export const coursePriceCentsSchema = z
  .number()
  .int("Price must be an integer in cents")
  .min(1900, "Minimum course price is $19 (1900 cents)")
  .max(19900, "Maximum course price is $199 (19900 cents)");

// Description synopsis is measured in words (600 max), matching the formulate-UI counter.
function withinWordLimit(value: string, limit: number): boolean {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length <= limit : true;
}

const courseDescriptionSchema = z
  .string()
  .trim()
  .max(4000, "Description must be 4000 characters or fewer")
  .refine(
    (value) => withinWordLimit(value, 600),
    "Description must be 600 words or fewer"
  )
  .optional()
  .nullable();

export const httpsUrlSchema = z
  .string()
  .trim()
  .url("Invalid URL format")
  .refine(
    (val) => {
      try {
        const url = new URL(val);
        return url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Thumbnail URL must use the HTTPS protocol" }
  );

export const createCourseSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100),
  description: courseDescriptionSchema,
  category: z.string().trim().min(1).max(50).optional(),
  thumbnailUrl: httpsUrlSchema.optional().nullable(),
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
  description: courseDescriptionSchema,
  category: z.string().trim().min(1).max(50).optional(),
  thumbnailUrl: httpsUrlSchema.optional().nullable(),
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

export const createLessonSchema = z.object({
  courseId: z.string().trim().min(1, "Course ID is required"),
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  durationSeconds: z.number().int().min(0).optional().nullable(),
  isPreview: z.boolean().optional(),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  durationSeconds: z.number().int().min(0).optional().nullable(),
  isPreview: z.boolean().optional(),
});

export const reorderLessonsSchema = z.object({
  courseId: z.string().trim().min(1, "Course ID is required"),
  lessonIds: z
    .array(z.string().trim().min(1))
    .min(1, "At least one lesson ID is required")
    .max(200, "Cannot reorder more than 200 lessons at once"),
});

export const lessonIdParamSchema = z.object({
  lessonId: z.string().trim().min(1, "Lesson ID is required"),
});
