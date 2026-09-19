import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

export type TestDb = PgliteDatabase<typeof schema>;

let _db: TestDb | undefined;

export async function getTestDb(): Promise<TestDb> {
  if (!_db) {
    const client = new PGlite({ relaxedDurability: true });
    _db = drizzle(client, { schema });
    await migrate(_db, { migrationsFolder: "./drizzle" });
  }
  return _db;
}

/** Wipe all rows between tests using atomic TRUNCATE with RESTART IDENTITY CASCADE. */
export async function cleanDb(db: TestDb) {
  await db.execute(sql`
    TRUNCATE TABLE
      "entitlements",
      "lesson_progress",
      "purchases",
      "subscriptions",
      "processed_stripe_events",
      "reconcile_attempts",
      "refund_tombstones",
      "session",
      "account",
      "verification",
      "lessons",
      "courses",
      "user"
    RESTART IDENTITY CASCADE;
  `);
}
