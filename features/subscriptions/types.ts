import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { subscriptions } from "@/lib/db/schema";

export type Subscription = InferSelectModel<typeof subscriptions>;
export type NewSubscription = InferInsertModel<typeof subscriptions>;

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface CreateSubscriptionCheckoutInput {
  userId: string;
  customerEmail?: string;
  stripeCustomerId?: string;
  hasUsedTrial?: boolean;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCustomerPortalInput {
  customerId: string;
  returnUrl: string;
}
