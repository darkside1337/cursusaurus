import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { entitlements } from "@/db/schema";
import { grantEntitlementSchema, revokeEntitlementSchema } from "./schemas";
import type { GrantEntitlementInput, RevokeEntitlementInput, Entitlement } from "./types";

/**
 * Grants an entitlement to a user.
 * null courseId = all-access (subscription-sourced or global grant).
 */
export async function grantEntitlement(input: GrantEntitlementInput): Promise<Entitlement> {
  const validated = grantEntitlementSchema.parse(input);

  const [record] = await db
    .insert(entitlements)
    .values({
      id: crypto.randomUUID(),
      userId: validated.userId,
      courseId: validated.courseId ?? null,
      source: validated.source,
      grantedAt: new Date(),
    })
    .returning();

  return record;
}

/**
 * Revokes active entitlements matching user, course, and optional source.
 */
export async function revokeEntitlement(input: RevokeEntitlementInput): Promise<Entitlement[]> {
  const validated = revokeEntitlementSchema.parse(input);

  const conditions = [
    eq(entitlements.userId, validated.userId),
    isNull(entitlements.revokedAt),
  ];

  if (validated.courseId !== undefined) {
    if (validated.courseId === null) {
      conditions.push(isNull(entitlements.courseId));
    } else {
      conditions.push(eq(entitlements.courseId, validated.courseId));
    }
  }

  if (validated.source) {
    conditions.push(eq(entitlements.source, validated.source));
  }

  return await db
    .update(entitlements)
    .set({ revokedAt: new Date() })
    .where(and(...conditions))
    .returning();
}

/**
 * Revokes all-access subscription entitlements only.
 * Invariant #4: Purchase-sourced entitlements for any course are never touched.
 */
export async function revokeSubscriptionEntitlements(userId: string): Promise<Entitlement[]> {
  return await db
    .update(entitlements)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(entitlements.userId, userId),
        isNull(entitlements.courseId),
        eq(entitlements.source, "subscription"),
        isNull(entitlements.revokedAt)
      )
    )
    .returning();
}

/**
 * Revokes purchase-sourced entitlement for a specific course only.
 * Invariant #6: Progress rows are never touched on refund.
 */
export async function revokePurchaseEntitlement(
  userId: string,
  courseId: string
): Promise<Entitlement[]> {
  return await db
    .update(entitlements)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.courseId, courseId),
        eq(entitlements.source, "purchase"),
        isNull(entitlements.revokedAt)
      )
    )
    .returning();
}
