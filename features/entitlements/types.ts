import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { entitlements } from "@/lib/db/schema";

export type Entitlement = InferSelectModel<typeof entitlements>;
export type NewEntitlement = InferInsertModel<typeof entitlements>;

export type EntitlementSource = "purchase" | "subscription" | "admin_grant";

export interface GrantEntitlementInput {
  userId: string;
  courseId?: string | null; // null = all-access (Invariant #3)
  source: EntitlementSource;
}

export interface RevokeEntitlementInput {
  userId: string;
  courseId?: string | null;
  source?: EntitlementSource;
}
