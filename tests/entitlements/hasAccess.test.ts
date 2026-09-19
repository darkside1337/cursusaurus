import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb, seedUser, seedCourse, seedEntitlement, type TestDb } from "../helpers";
import { hasAccess } from "@/features/entitlements";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("hasAccess(userId, courseId) Integration Test Matrix", () => {
  let userA: { id: string };
  let userB: { id: string };
  let course1: { id: string };
  let course2: { id: string };

  const checkAccess = (userId: string, courseId: string) =>
    hasAccess(userId, courseId);

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);

    userA = await seedUser(testDb, { name: "Learner A" });
    userB = await seedUser(testDb, { name: "Learner B" });
    course1 = await seedCourse(testDb, { title: "Course 1" });
    course2 = await seedCourse(testDb, { title: "Course 2" });
  });

  it("Scenario 1: returns false when user has no entitlement at all", async () => {
    const access = await checkAccess(userA.id, course1.id);
    expect(access).toBe(false);
  });

  it("Scenario 2: returns true for active course-scoped entitlement (purchase)", async () => {
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: course1.id,
      source: "purchase",
      revokedAt: null,
    });

    const access = await checkAccess(userA.id, course1.id);
    expect(access).toBe(true);
  });

  it("Scenario 3: returns true for active all-access entitlement (subscription, courseId=null)", async () => {
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const access = await checkAccess(userA.id, course1.id);
    expect(access).toBe(true);
  });

  it("Scenario 4: returns true for all-access entitlement when checking any different courseId", async () => {
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const access1 = await checkAccess(userA.id, course1.id);
    const access2 = await checkAccess(userA.id, course2.id);
    expect(access1).toBe(true);
    expect(access2).toBe(true);
  });

  it("Scenario 5: returns true for trialing subscription (active entitlement, not revoked)", async () => {
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const access = await checkAccess(userA.id, course1.id);
    expect(access).toBe(true);
  });

  it("Scenario 6: returns true when both purchase-scoped and active subscription exist", async () => {
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: course1.id,
      source: "purchase",
      revokedAt: null,
    });
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const access = await checkAccess(userA.id, course1.id);
    expect(access).toBe(true);
  });

  it("Scenario 7: returns false when purchase entitlement is revoked", async () => {
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: course1.id,
      source: "purchase",
      revokedAt: new Date(),
    });

    const access = await checkAccess(userA.id, course1.id);
    expect(access).toBe(false);
  });

  it("Scenario 8: returns false when subscription entitlement is revoked", async () => {
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: null,
      source: "subscription",
      revokedAt: new Date(),
    });

    const access = await checkAccess(userA.id, course1.id);
    expect(access).toBe(false);
  });

  it("Scenario 9: returns false when subscription is past_due (entitlement revoked)", async () => {
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: null,
      source: "subscription",
      revokedAt: new Date(),
    });

    const access = await checkAccess(userA.id, course1.id);
    expect(access).toBe(false);
  });

  it("Scenario 10: returns true when subscription is canceled/revoked but purchase-scoped entitlement remains intact", async () => {
    // Revoked subscription
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: null,
      source: "subscription",
      revokedAt: new Date(),
    });
    // Active purchase
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: course1.id,
      source: "purchase",
      revokedAt: null,
    });

    // Course 1 is purchased -> true
    expect(await checkAccess(userA.id, course1.id)).toBe(true);
    // Course 2 was only via subscription -> false
    expect(await checkAccess(userA.id, course2.id)).toBe(false);
  });

  it("Scenario 11: returns true when purchase is refunded (revoked) but subscription is still active", async () => {
    // Revoked purchase for course 1
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: course1.id,
      source: "purchase",
      revokedAt: new Date(),
    });
    // Active subscription
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    expect(await checkAccess(userA.id, course1.id)).toBe(true);
    expect(await checkAccess(userA.id, course2.id)).toBe(true);
  });

  it("Scenario 12: returns false after refund when no other entitlement exists", async () => {
    await seedEntitlement(testDb, {
      userId: userA.id,
      courseId: course1.id,
      source: "purchase",
      revokedAt: new Date(),
    });

    const access = await checkAccess(userA.id, course1.id);
    expect(access).toBe(false);
  });

  describe("Edge cases & boundaries", () => {
    it("does not grant access to course B when user only purchased course A", async () => {
      await seedEntitlement(testDb, {
        userId: userA.id,
        courseId: course1.id,
        source: "purchase",
        revokedAt: null,
      });

      expect(await checkAccess(userA.id, course1.id)).toBe(true);
      expect(await checkAccess(userA.id, course2.id)).toBe(false);
    });

    it("does not leak entitlements across different users", async () => {
      await seedEntitlement(testDb, {
        userId: userA.id,
        courseId: course1.id,
        source: "purchase",
        revokedAt: null,
      });

      expect(await checkAccess(userA.id, course1.id)).toBe(true);
      expect(await checkAccess(userB.id, course1.id)).toBe(false);
    });

    it("throws a validation error when given empty or invalid IDs", async () => {
      await expect(checkAccess("", course1.id)).rejects.toThrow();
      await expect(checkAccess(userA.id, "")).rejects.toThrow();
    });
  });
});
