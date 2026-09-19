import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedEntitlement,
  type TestDb,
} from "../helpers";
import { entitlements } from "@/lib/db/schema";
import { grantEntitlement } from "@/features/entitlements/writers";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("P1-1: DB-Level Uniqueness on Active Entitlements", () => {
  let user: { id: string; email: string };
  let course: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "uniqueness@example.com" });
    const creator = await seedUser(testDb, { name: "Creator" });
    course = await seedCourse(testDb, { creatorId: creator.id });
  });

  it("partial unique index prevents duplicate active course-scoped entitlements", async () => {
    // First active entitlement succeeds
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: course.id,
      source: "purchase",
      revokedAt: null,
    });

    // Attempting duplicate active insert directly into DB fails
    await expect(
      testDb.insert(entitlements).values({
        id: crypto.randomUUID(),
        userId: user.id,
        courseId: course.id,
        source: "purchase",
        grantedAt: new Date(),
        revokedAt: null,
      })
    ).rejects.toThrow();
  });

  it("partial unique index prevents duplicate active all-access entitlements", async () => {
    // First active all-access succeeds
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    // Attempting duplicate active all-access insert directly into DB fails
    await expect(
      testDb.insert(entitlements).values({
        id: crypto.randomUUID(),
        userId: user.id,
        courseId: null,
        source: "subscription",
        grantedAt: new Date(),
        revokedAt: null,
      })
    ).rejects.toThrow();
  });

  it("allows multiple revoked entitlements for same user, course, and source", async () => {
    // Revoked grant 1
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: course.id,
      source: "purchase",
      revokedAt: new Date(Date.now() - 86400000),
    });

    // Revoked grant 2 (succeeds because revoked_at is NOT null)
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: course.id,
      source: "purchase",
      revokedAt: new Date(),
    });

    // Active grant (succeeds)
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: course.id,
      source: "purchase",
      revokedAt: null,
    });

    const rows = await testDb.select().from(entitlements);
    expect(rows).toHaveLength(3);
  });

  it("grantEntitlement is idempotent and does not throw on duplicate grants", async () => {
    const grant1 = await grantEntitlement({
      userId: user.id,
      courseId: course.id,
      source: "purchase",
    });
    expect(grant1).toBeDefined();

    const grant2 = await grantEntitlement({
      userId: user.id,
      courseId: course.id,
      source: "purchase",
    });
    expect(grant2).toBeDefined();
    expect(grant2.id).toBe(grant1.id);

    const rows = await testDb.select().from(entitlements);
    expect(rows).toHaveLength(1);
  });
});
