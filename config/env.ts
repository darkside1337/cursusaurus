import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  server: {
    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // Better Auth
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),

    // OAuth Providers (Optional / can be empty string or undefined)
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Stripe
    STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_ALL_ACCESS_PRICE_ID: z.string().optional(),

    // Supabase
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
      .string()
      .min(1, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
});

if (
  process.env.NODE_ENV === "production" &&
  process.env.npm_lifecycle_event !== "build" &&
  !process.env.NEXT_PHASE?.includes("build") &&
  !process.env.CI &&
  !env.STRIPE_WEBHOOK_SECRET
) {
  throw new Error("STRIPE_WEBHOOK_SECRET is required in production (Stripe webhooks)");
}
