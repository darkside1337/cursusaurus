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
import { revokeEntitlement } from "@/features/entitlements/writers";
import { isNull } from "drizzle-orm";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("P1-3: Revoke Entitlement Scoping Validation Guard", () => {
  let user: { id: string; email: string };
  let course1: { id: string; slug: string };
  let course2: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "revoke-guard@example.com" });
    const creator = await seedUser(testDb, { name: "Creator" });
    course1 = await seedCourse(testDb, { creatorId: creator.id });
    course2 = await seedCourse(testDb, { creatorId: creator.id });

    // Seed two active entitlements
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: course1.id,
      source: "purchase",
      revokedAt: null,
    });
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: course2.id,
      source: "purchase",
      revokedAt: null,
    });
  });

  it("fails validation when neither courseId nor source is provided", async () => {
    // Attempting to revoke with ONLY userId should fail Zod schema refinement
    await expect(
      revokeEntitlement({ userId: user.id })
    ).rejects.toThrow(/Either courseId or source must be specified/);

    // Verify neither entitlement was revoked
    const active = await testDb
      .select()
      .from(entitlements)
      .where(isNull(entitlements.revokedAt));
    expect(active).toHaveLength(2);
  });

  it("succeeds when courseId is provided", async () => {
    const revoked = await revokeEntitlement({
      userId: user.id,
      courseId: course1.id,
    });
    expect(revoked).toHaveLength(1);
    expect(revoked[0].courseId).toBe(course1.id);

    // Verify course2 is still active
    const active = await testDb
      .select()
      .from(entitlements)
      .where(isNull(entitlements.revokedAt));
    expect(active).toHaveLength(1);
    expect(active[0].courseId).toBe(course2.id);
  });

  it("succeeds when source is provided", async () => {
    const revoked = await revokeEntitlement({
      userId: user.id,
      source: "purchase",
    });
    expect(revoked).toHaveLength(2);

    // All purchase entitlements revoked
    const active = await testDb
      .select()
      .from(entitlements)
      .where(isNull(entitlements.revokedAt));
    expect(active).toHaveLength(0);
  });
});
