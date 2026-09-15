import { z } from "zod";

export const hasAccessSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
});

export const grantEntitlementSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().nullable().optional(),
  source: z.enum(["purchase", "subscription", "admin_grant"]),
});

export const revokeEntitlementSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  courseId: z.string().nullable().optional(),
  source: z.enum(["purchase", "subscription", "admin_grant"]).optional(),
});
