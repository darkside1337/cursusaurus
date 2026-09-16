import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

export type TestDb = PgliteDatabase<typeof schema>;

let _db: TestDb | undefined;

export async function getTestDb(): Promise<TestDb> {
  if (!_db) {
    const client = new PGlite();
    _db = drizzle(client, { schema });
    await migrate(_db, { migrationsFolder: "./drizzle" });
  }
  return _db;
}

/** Wipe all rows between tests (child → parent FK order using staged Promise.all). */
export async function cleanDb(db: TestDb) {
  // 1. Delete leaf child tables concurrently
  await Promise.all([
    db.delete(schema.entitlements),
    db.delete(schema.lessonProgress),
    db.delete(schema.purchases),
    db.delete(schema.subscriptions),
    db.delete(schema.session),
    db.delete(schema.account),
    db.delete(schema.verification),
  ]);

  // 2. Delete lessons (references courses)
  await db.delete(schema.lessons);

  // 3. Delete courses (references user)
  await db.delete(schema.courses);

  // 4. Delete root user table
  await db.delete(schema.user);
}
