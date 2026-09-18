WITH ranked_course_entitlements AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, course_id, source
           ORDER BY granted_at DESC, id DESC
         ) as rn
  FROM entitlements
  WHERE revoked_at IS NULL AND course_id IS NOT NULL
)
UPDATE entitlements
SET revoked_at = NOW()
WHERE id IN (
  SELECT id FROM ranked_course_entitlements WHERE rn > 1
);
--> statement-breakpoint
WITH ranked_all_access_entitlements AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, source
           ORDER BY granted_at DESC, id DESC
         ) as rn
  FROM entitlements
  WHERE revoked_at IS NULL AND course_id IS NULL
)
UPDATE entitlements
SET revoked_at = NOW()
WHERE id IN (
  SELECT id FROM ranked_all_access_entitlements WHERE rn > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_active_course_idx" ON "entitlements" USING btree ("user_id","course_id","source") WHERE "entitlements"."revoked_at" IS NULL AND "entitlements"."course_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_active_all_access_idx" ON "entitlements" USING btree ("user_id","source") WHERE "entitlements"."revoked_at" IS NULL AND "entitlements"."course_id" IS NULL;