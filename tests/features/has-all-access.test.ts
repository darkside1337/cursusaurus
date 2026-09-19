import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedEntitlement,
  seedSubscription,
  type TestDb,
} from "../helpers";
import { hasAllAccess } from "@/features/entitlements/access";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("P1-2: Authoritative hasAllAccess Entitlement Query (Invariant #1)", () => {
  let user: { id: string; email: string };
  let course: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "has-all-access@example.com" });
    const creator = await seedUser(testDb, { name: "Author" });
    course = await seedCourse(testDb, { creatorId: creator.id });
  });

  it("returns true when an unrevoked All-Access entitlement (courseId = null) exists", async () => {
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const result = await hasAllAccess(user.id);
    expect(result).toBe(true);
  });

  it("returns false when All-Access entitlement is revoked", async () => {
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: new Date(),
    });

    const result = await hasAllAccess(user.id);
    expect(result).toBe(false);
  });

  it("returns false when user only has course-scoped entitlements", async () => {
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: course.id,
      source: "purchase",
      revokedAt: null,
    });

    const result = await hasAllAccess(user.id);
    expect(result).toBe(false);
  });

  it("does not read subscriptions table (Invariant #1)", async () => {
    // User has an active row in subscriptions table, BUT no record in entitlements table
    await seedSubscription(testDb, {
      userId: user.id,
      status: "active",
    });

    // Authoritative check must return false because entitlements table is sole source of truth
    const result = await hasAllAccess(user.id);
    expect(result).toBe(false);
  });
});
