import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLesson,
  seedEntitlement,
  type TestDb,
} from "../helpers";
import { getLearnerLibrary } from "@/features/library";
import { lessonProgress, subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("Learner Library Queries (features/library/queries.ts)", () => {
  let user: { id: string };
  let courseA: { id: string; slug: string };
  let courseB: { id: string; slug: string };
  let lessonA1: { id: string };
  let lessonB1: { id: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);

    user = await seedUser(testDb, { name: "Learner Library Test" });
    courseA = await seedCourse(testDb, {
      title: "Typography Essentials",
      slug: "typography-essentials",
      category: "Design",
      isPublished: true,
    });
    courseB = await seedCourse(testDb, {
      title: "Advanced Grid Systems",
      slug: "advanced-grid-systems",
      category: "Design",
      isPublished: true,
    });

    lessonA1 = await seedLesson(testDb, {
      courseId: courseA.id,
      title: "Letterforms",
      slug: "letterforms",
      orderIndex: 1,
      durationSeconds: 1200, // 20m
    });
    await seedLesson(testDb, {
      courseId: courseA.id,
      title: "Leading & Kerning",
      slug: "leading-and-kerning",
      orderIndex: 2,
      durationSeconds: 1800, // 30m
    });

    lessonB1 = await seedLesson(testDb, {
      courseId: courseB.id,
      title: "Modular Grids",
      slug: "modular-grids",
      orderIndex: 1,
      durationSeconds: 3600, // 60m
    });
  });

  it("Purchase-only learner sees only owned courses", async () => {
    // User only bought Course A
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: courseA.id,
      source: "purchase",
      revokedAt: null,
    });

    const library = await getLearnerLibrary(user.id);
    expect(library.courses.length).toBe(1);
    expect(library.courses[0].id).toBe(courseA.id);
    expect(library.courses[0].accessType).toBe("purchased");
    expect(library.hasAllAccess).toBe(false);
  });

  it("All-Access subscriber sees all published courses with lessons", async () => {
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const library = await getLearnerLibrary(user.id);
    expect(library.courses.length).toBe(2);
    expect(library.hasAllAccess).toBe(true);

    const types = library.courses.map((c) => c.accessType);
    expect(types).toEqual(["all-access", "all-access"]);
  });

  it("Dual entitlement: owned course gets 'purchased', others get 'all-access'", async () => {
    // Purchased Course A + holds All-Access
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: courseA.id,
      source: "purchase",
      revokedAt: null,
    });
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const library = await getLearnerLibrary(user.id);
    expect(library.courses.length).toBe(2);

    const itemA = library.courses.find((c) => c.id === courseA.id);
    const itemB = library.courses.find((c) => c.id === courseB.id);

    expect(itemA?.accessType).toBe("purchased");
    expect(itemB?.accessType).toBe("all-access");
  });

  it("Refunded course is excluded from active library; progress records remain in Postgres", async () => {
    // Granted then refunded
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: courseA.id,
      source: "purchase",
      revokedAt: new Date(),
    });

    // Learner had recorded progress
    await testDb.insert(lessonProgress).values({
      id: crypto.randomUUID(),
      userId: user.id,
      courseId: courseA.id,
      lessonId: lessonA1.id,
      completed: true,
      lastPositionSeconds: 1200,
    });

    const library = await getLearnerLibrary(user.id);
    expect(library.courses.length).toBe(0);

    // Progress record still exists in DB
    const [savedProgress] = await testDb
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, user.id));
    expect(savedProgress).toBeDefined();
    expect(savedProgress.completed).toBe(true);
  });

  it("Immediate past_due revocation: subscription courses removed, standalone purchases remain accessible", async () => {
    // User owns Course A perpetual license
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: courseA.id,
      source: "purchase",
      revokedAt: null,
    });

    // Subscription All-Access entitlement was revoked due to past_due
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: new Date(),
    });

    // Subscriptions row has status past_due
    await testDb.insert(subscriptions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      stripeSubscriptionId: "sub_past_due_123",
      stripeCustomerId: "cus_123",
      status: "past_due",
      currentPeriodEnd: new Date(),
    });

    const library = await getLearnerLibrary(user.id);

    // Subscription-only Course B is excluded; standalone Course A remains
    expect(library.courses.length).toBe(1);
    expect(library.courses[0].id).toBe(courseA.id);
    expect(library.courses[0].accessType).toBe("purchased");
    expect(library.isSubscriptionPastDue).toBe(true);
  });

  it("Accessible Metrics Boundary: metrics strictly exclude progress from inaccessible / past_due courses", async () => {
    // User completed lesson in Course B while All-Access was active
    await testDb.insert(lessonProgress).values({
      id: crypto.randomUUID(),
      userId: user.id,
      courseId: courseB.id,
      lessonId: lessonB1.id,
      completed: true,
      lastPositionSeconds: 3600,
    });

    // When All-Access is active: Course B counts toward metrics
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    let library = await getLearnerLibrary(user.id);
    expect(library.metrics.activeSyllabiCount).toBe(1);
    expect(library.metrics.hoursMastered).toBe(1); // 3600s = 1.0h
    expect(library.metrics.completedSyllabiCount).toBe(1); // Course B is 1/1 completed

    // Now subscription lapses / becomes past_due (revoked)
    await cleanDb(testDb);
    user = await seedUser(testDb, { name: "Learner Lapsed" });
    courseA = await seedCourse(testDb, { title: "A", slug: "a", isPublished: true });
    courseB = await seedCourse(testDb, { title: "B", slug: "b", isPublished: true });
    lessonB1 = await seedLesson(testDb, {
      courseId: courseB.id,
      title: "B1",
      slug: "b1",
      durationSeconds: 3600,
    });

    await testDb.insert(lessonProgress).values({
      id: crypto.randomUUID(),
      userId: user.id,
      courseId: courseB.id,
      lessonId: lessonB1.id,
      completed: true,
      lastPositionSeconds: 3600,
    });

    // Entitlement revoked:
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: new Date(),
    });

    await testDb.insert(subscriptions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      stripeSubscriptionId: "sub_lapsed_999",
      stripeCustomerId: "cus_999",
      status: "past_due",
      currentPeriodEnd: new Date(),
    });

    library = await getLearnerLibrary(user.id);

    // Active metrics MUST be 0 because learner currently has 0 accessible courses!
    expect(library.courses.length).toBe(0);
    expect(library.metrics.activeSyllabiCount).toBe(0);
    expect(library.metrics.hoursMastered).toBe(0);
    expect(library.metrics.completedSyllabiCount).toBe(0);
  });

  it("Published courses with 0 lessons (Coming Soon) are excluded from library grid", async () => {
    // Course with 0 lessons
    await seedCourse(testDb, {
      title: "Future Syllabus",
      slug: "future-syllabus",
      isPublished: true,
    });

    // User has All-Access
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const library = await getLearnerLibrary(user.id);
    const titles = library.courses.map((c) => c.title);

    expect(titles).toContain("Typography Essentials");
    expect(titles).toContain("Advanced Grid Systems");
    expect(titles).not.toContain("Future Syllabus");
  });
});
