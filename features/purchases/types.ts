import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { purchases } from "@/db/schema";

export type Purchase = InferSelectModel<typeof purchases>;
export type NewPurchase = InferInsertModel<typeof purchases>;

export type OrderStatus = "pending" | "completed" | "failed";

export interface CreatePurchaseCheckoutInput {
  userId: string;
  courseId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PurchaseOrderStatusResult {
  status: OrderStatus;
  courseId?: string;
  courseSlug?: string;
}
