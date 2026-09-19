import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { purchases } from "@/lib/db/schema";

export type Purchase = InferSelectModel<typeof purchases>;
export type NewPurchase = InferInsertModel<typeof purchases>;

export type PurchaseStatus = "completed" | "refunded" | "failed" | "pending";
export type OrderStatus = "pending" | "completed" | "failed";

export interface CreatePurchaseCheckoutInput {
  userId: string;
  userEmail?: string;
  stripeCustomerId?: string;
  courseId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PurchaseOrderStatusResult {
  status: OrderStatus;
  courseId?: string;
  courseSlug?: string;
}
