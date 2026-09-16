import { betterAuth } from "better-auth";
import { testUtils, type TestHelpers } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * Test-only Better Auth instance. Kept out of `lib/auth.ts` because `testUtils()`
 * exposes privileged `ctx.test` helpers (createUser/saveUser/getCookies/...).
 * Shares the production adapter/schema/secret so sessions it mints are accepted
 * by the app's server — dev server + Vitest friendly, no HMAC ceremony.
 */
export const testAuth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [testUtils()],
});

export type SessionCookies = Awaited<ReturnType<TestHelpers["getCookies"]>>;

/**
 * Playwright-ready session cookies for a user, via ctx.test.getCookies().
 * Pass the result to `browserContext.addCookies(cookies)` before navigating.
 */
export async function getSessionCookies(
  userId: string,
  domain = "localhost"
): Promise<SessionCookies> {
  const test = (await testAuth.$context).test;
  return test.getCookies({ userId, domain });
}