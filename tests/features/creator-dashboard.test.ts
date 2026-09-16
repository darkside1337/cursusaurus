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
import {
  listCoursesWithStatsByCreator,
  createCourse,
} from "@/features/courses";

let testDb: TestDb;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("Chunk 2.2 — Creator Course List & Creation", () => {
  let creatorA: { id: string };
  let creatorB: { id: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);

    creatorA = await seedUser(testDb, { name: "Creator A" });
    creatorB = await seedUser(testDb, { name: "Creator B" });
  });

  describe("listCoursesWithStatsByCreator", () => {
    it("returns empty courses and zero stats when creator has no courses", async () => {
      const data = await listCoursesWithStatsByCreator(creatorA.id);

      expect(data.courses).toHaveLength(0);
      expect(data.stats).toEqual({
        totalStudents: 0,
        publishedCount: 0,
        draftCount: 0,
        royaltiesCents: 0,
      });
    });

    it("scopes courses strictly to the specified creator", async () => {
      await seedCourse(testDb, {
        creatorId: creatorA.id,
        title: "Creator A Course",
        isPublished: true,
      });
      await seedCourse(testDb, {
        creatorId: creatorB.id,
        title: "Creator B Course",
        isPublished: true,
      });

      const dataA = await listCoursesWithStatsByCreator(creatorA.id);
      expect(dataA.courses).toHaveLength(1);
      expect(dataA.courses[0].title).toBe("Creator A Course");
      expect(dataA.stats.publishedCount).toBe(1);

      const dataB = await listCoursesWithStatsByCreator(creatorB.id);
      expect(dataB.courses).toHaveLength(1);
      expect(dataB.courses[0].title).toBe("Creator B Course");
      expect(dataB.stats.publishedCount).toBe(1);
    });

    it("accurately calculates stats and lesson counts across published and draft courses", async () => {
      // Course 1: published with 2 lessons
      const c1 = await seedCourse(testDb, {
        creatorId: creatorA.id,
        title: "Typography Masterclass",
        isPublished: true,
      });
      await seedLesson(testDb, { courseId: c1.id, title: "Lesson 1", durationSeconds: 300 });
      await seedLesson(testDb, { courseId: c1.id, title: "Lesson 2", durationSeconds: 450 });

      // Course 2: draft with 1 lesson
      const c2 = await seedCourse(testDb, {
        creatorId: creatorA.id,
        title: "Draft Design Systems",
        isPublished: false,
      });
      await seedLesson(testDb, { courseId: c2.id, title: "Lesson 1", durationSeconds: 600 });

      // Course 3: draft with 0 lessons
      await seedCourse(testDb, {
        creatorId: creatorA.id,
        title: "Empty Draft Formulation",
        isPublished: false,
      });

      const data = await listCoursesWithStatsByCreator(creatorA.id);

      expect(data.stats).toEqual({
        totalStudents: 0,
        publishedCount: 1,
        draftCount: 2,
        royaltiesCents: 0,
      });

      // Verify course-level items
      const c1Item = data.courses.find((c) => c.id === c1.id);
      expect(c1Item).toBeDefined();
      expect(c1Item?.lessonCount).toBe(2);
      expect(c1Item?.totalDurationSeconds).toBe(750);
      expect(c1Item?.readiness.isPurchaseEligible).toBe(true);
      expect(c1Item?.readiness.status).toBe("ready");

      const c2Item = data.courses.find((c) => c.id === c2.id);
      expect(c2Item).toBeDefined();
      expect(c2Item?.lessonCount).toBe(1);
      expect(c2Item?.readiness.isPurchaseEligible).toBe(false);
      expect(c2Item?.readiness.status).toBe("draft");
    });

    it("derives students, royalties, and per-course sales from entitlements", async () => {
      const learnerA = await seedUser(testDb, { name: "Learner A" });
      const learnerB = await seedUser(testDb, { name: "Learner B" });

      const course = await seedCourse(testDb, {
        creatorId: creatorA.id,
        title: "Revenue Course",
        priceCents: 4900,
        isPublished: true,
      });

      // Learner A buys the course (counts toward sales, students, royalties)
      await seedEntitlement(testDb, {
        userId: learnerA.id,
        courseId: course.id,
        source: "purchase",
      });

      // Learner B bought it then was refunded (excluded everywhere)
      await seedEntitlement(testDb, {
        userId: learnerB.id,
        courseId: course.id,
        source: "purchase",
        revokedAt: new Date(),
      });

      // Learner B holds an active All-Access subscription (counts as a student, not a sale or royalty)
      await seedEntitlement(testDb, {
        userId: learnerB.id,
        source: "subscription",
      });

      // A purchase on another creator's course must not leak in
      const otherCourse = await seedCourse(testDb, {
        creatorId: creatorB.id,
        title: "Other Creator Course",
        priceCents: 7000,
        isPublished: true,
      });
      await seedEntitlement(testDb, {
        userId: learnerB.id,
        courseId: otherCourse.id,
        source: "purchase",
      });

      const data = await listCoursesWithStatsByCreator(creatorA.id);

      const courseItem = data.courses.find((c) => c.id === course.id);
      expect(courseItem?.salesCount).toBe(1);
      expect(data.stats.totalStudents).toBe(2);
      expect(data.stats.royaltiesCents).toBe(4900);
    });
  });

  describe("Course Formulation & Validation", () => {
    it("creates draft course with auto-generated slug and defaults to unpublished", async () => {
      const course = await createCourse({
        creatorId: creatorA.id,
        title: "Principles of Swiss Grid Systems",
        priceCents: 4900,
        description: "An in-depth curriculum on modernist layout.",
        thumbnailUrl: "https://example.com/thumbnail.png",
      });

      expect(course.id).toBeDefined();
      expect(course.title).toBe("Principles of Swiss Grid Systems");
      expect(course.slug).toBe("principles-of-swiss-grid-systems");
      expect(course.priceCents).toBe(4900);
      expect(course.isPublished).toBe(false);
      expect(course.thumbnailUrl).toBe("https://example.com/thumbnail.png");
    });

    it("enforces $19–$199 boundary on course creation", async () => {
      // Below $19 (1899 cents)
      await expect(
        createCourse({
          creatorId: creatorA.id,
          title: "Cheap Course",
          priceCents: 1800,
        })
      ).rejects.toThrow();

      // Above $199 (19901 cents)
      await expect(
        createCourse({
          creatorId: creatorA.id,
          title: "Expensive Course",
          priceCents: 20000,
        })
      ).rejects.toThrow();

      // Valid boundary values
      const minCourse = await createCourse({
        creatorId: creatorA.id,
        title: "Minimum Price Course",
        priceCents: 1900,
      });
      expect(minCourse.priceCents).toBe(1900);

      const maxCourse = await createCourse({
        creatorId: creatorA.id,
        title: "Maximum Price Course",
        priceCents: 19900,
      });
      expect(maxCourse.priceCents).toBe(19900);
    });

    it("requires title length to be at least 3 characters", async () => {
      await expect(
        createCourse({
          creatorId: creatorA.id,
          title: "AB",
          priceCents: 4900,
        })
      ).rejects.toThrow("Title must be at least 3 characters");
    });

    it("rejects descriptions longer than 600 words", async () => {
      const longDescription = Array.from({ length: 601 }, () => "word").join(
        " "
      );

      await expect(
        createCourse({
          creatorId: creatorA.id,
          title: "Word Limit Course",
          priceCents: 4900,
          description: longDescription,
        })
      ).rejects.toThrow("Description must be 600 words or fewer");
    });
  });
});
