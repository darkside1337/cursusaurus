ALTER TABLE "reconcile_attempts" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "reconcile_attempts" ADD COLUMN "status" text DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE "reconcile_attempts" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "reconcile_attempts" ADD CONSTRAINT "reconcile_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;