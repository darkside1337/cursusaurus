import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { entitlements } from "@/db/schema";
import type { Entitlement } from "./types";

export async function getUserEntitlements(
  userId: string,
  includeRevoked = false
): Promise<Entitlement[]> {
  const conditions = [eq(entitlements.userId, userId)];

  if (!includeRevoked) {
    conditions.push(isNull(entitlements.revokedAt));
  }

  return await db
    .select()
    .from(entitlements)
    .where(and(...conditions));
}
