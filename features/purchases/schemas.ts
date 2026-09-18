import { z } from "zod";

export const createPurchaseCheckoutSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  userEmail: z.string().email("Invalid email").optional(),
  stripeCustomerId: z.string().optional(),
  courseId: z.string().min(1, "Course ID is required"),
  successUrl: z.string().url("Success URL must be a valid URL"),
  cancelUrl: z.string().url("Cancel URL must be a valid URL"),
});

export const orderStatusParamSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
});
