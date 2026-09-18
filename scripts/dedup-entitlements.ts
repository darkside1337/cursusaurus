import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Pre-migration dedup script for entitlements table.
 *
 * Before applying partial unique indexes:
 * - entitlements_active_course_idx: (user_id, course_id, source) WHERE revoked_at IS NULL AND course_id IS NOT NULL
 * - entitlements_active_all_access_idx: (user_id, source) WHERE revoked_at IS NULL AND course_id IS NULL
 *
 * This script soft-revokes older duplicates (keeps the newest granted_at per partition)
 * so that index creation succeeds without unique constraint violations.
 */
export async function dedupEntitlements(database = db) {
  console.log("Running pre-migration entitlement deduplication...");

  // 1. Soft-revoke duplicate active course-scoped entitlements
  await database.execute(sql`
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
  `);

  // 2. Soft-revoke duplicate active all-access entitlements
  await database.execute(sql`
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
  `);

  console.log("Entitlement deduplication completed successfully.");
}

// Allow direct CLI execution
if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.endsWith("dedup-entitlements.ts"))) {
  dedupEntitlements()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Entitlement deduplication failed:", err);
      process.exit(1);
    });
}
