import { z } from "zod";

export const createSubscriptionCheckoutSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  customerEmail: z.string().email("Invalid email address").optional(),
  priceId: z.string().min(1, "Stripe Price ID is required"),
  successUrl: z.string().url("Success URL must be a valid URL"),
  cancelUrl: z.string().url("Cancel URL must be a valid URL"),
});

export const createCustomerPortalSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  returnUrl: z.string().url("Return URL must be a valid URL"),
});
