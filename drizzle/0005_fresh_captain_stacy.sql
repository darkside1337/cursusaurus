CREATE TABLE "reconcile_attempts" (
	"stripe_session_id" text PRIMARY KEY NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_tombstones" (
	"stripe_payment_intent_id" text PRIMARY KEY NOT NULL,
	"refunded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "price_paid_cents" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_session_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_event_epoch" bigint;--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_session_id_idx" ON "subscriptions" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_active_user" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."status" IN ('trialing','active');