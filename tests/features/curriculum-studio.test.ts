import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLesson,
  seedLessonProgress,
  type TestDb,
} from "../helpers";
import {
  updateCourse,
  setCoursePublishStatus,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  getCourseById,
  getCourseWithLessons,
  getCourseReadiness,
} from "@/features/courses";

let testDb: TestDb;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("Chunk 2.3 — Creator Course & Curriculum Studio", () => {
  let creator: { id: string };
  let course: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);

    creator = await seedUser(testDb, { name: "Editorial Master" });
    course = await seedCourse(testDb, {
      creatorId: creator.id,
      title: "Principles of Graphic Form",
      category: "Design",
      priceCents: 4900,
      isPublished: false,
    });
  });

  describe("Course Metadata Management", () => {
    it("updates course title, description, category, and price", async () => {
      const updated = await updateCourse(course.id, {
        title: "Advanced Principles of Graphic Form",
        description: "An intensive monograph exploring layout, grid systems, and typography.",
        category: "Code",
        priceCents: 7900,
        thumbnailUrl: "https://example.com/cover.jpg",
      });

      expect(updated).not.toBeNull();
      expect(updated?.id).toBe(course.id); // Stable ID preserved
      expect(updated?.title).toBe("Advanced Principles of Graphic Form");
      expect(updated?.description).toContain("intensive monograph");
      expect(updated?.category).toBe("Code");
      expect(updated?.priceCents).toBe(7900);
      expect(updated?.thumbnailUrl).toBe("https://example.com/cover.jpg");

      // Verify immediate persistence in query
      const fetched = await getCourseById(course.id);
      expect(fetched?.title).toBe("Advanced Principles of Graphic Form");
      expect(fetched?.category).toBe("Code");
    });

    it("enforces PRD §8 price boundaries ($19–$199)", async () => {
      // Lower bound check: < 1900 cents should throw validation error
      await expect(
        updateCourse(course.id, {
          priceCents: 1800,
        })
      ).rejects.toThrow();

      // Upper bound check: > 19900 cents should throw validation error
      await expect(
        updateCourse(course.id, {
          priceCents: 20000,
        })
      ).rejects.toThrow();

      // Boundary values: 1900 and 19900 should succeed
      const minCourse = await updateCourse(course.id, { priceCents: 1900 });
      expect(minCourse?.priceCents).toBe(1900);

      const maxCourse = await updateCourse(course.id, { priceCents: 19900 });
      expect(maxCourse?.priceCents).toBe(19900);
    });

    it("maintains stable course ID when slug changes", async () => {
      const originalId = course.id;
      const updated = await updateCourse(course.id, {
        slug: "custom-graphic-form-slug",
      });

      expect(updated?.id).toBe(originalId);
      expect(updated?.slug).toBe("custom-graphic-form-slug");

      const bySlug = await getCourseWithLessons("custom-graphic-form-slug");
      expect(bySlug?.id).toBe(originalId);
    });
  });

  describe("Publication and Readiness Invariants", () => {
    it("handles draft -> published with 0 lessons as no_lessons and not purchase-eligible", async () => {
      const published = await setCoursePublishStatus(course.id, true);
      expect(published?.isPublished).toBe(true);

      const readiness = await getCourseReadiness(course.id);
      expect(readiness).toEqual({
        isPublished: true,
        isPurchaseEligible: false,
        status: "no_lessons",
        lessonCount: 0,
        totalDurationSeconds: 0,
      });
    });

    it("becomes ready and purchase-eligible immediately upon adding at least 1 lesson", async () => {
      await setCoursePublishStatus(course.id, true);

      await createLesson({
        courseId: course.id,
        title: "Lesson 1: Introduction to Spatial Rhythms",
        durationSeconds: 720,
        isPreview: true,
      });

      const readiness = await getCourseReadiness(course.id);
      expect(readiness?.status).toBe("ready");
      expect(readiness?.isPurchaseEligible).toBe(true);
      expect(readiness?.lessonCount).toBe(1);
      expect(readiness?.totalDurationSeconds).toBe(720);
    });

    it("readiness reverts to draft and purchase-ineligible when course is unpublished", async () => {
      await setCoursePublishStatus(course.id, true);
      await createLesson({
        courseId: course.id,
        title: "Lesson 1: Introduction",
        durationSeconds: 300,
      });

      const unpublished = await setCoursePublishStatus(course.id, false);
      expect(unpublished?.isPublished).toBe(false);

      const readiness = await getCourseReadiness(course.id);
      expect(readiness?.status).toBe("draft");
      expect(readiness?.isPurchaseEligible).toBe(false);
      expect(readiness?.lessonCount).toBe(1);
    });
  });

  describe("Curriculum Studio Lesson Actions & Invariants", () => {
    it("creates, updates, and reorders lessons with dense 0-indexing", async () => {
      const l1 = await createLesson({
        courseId: course.id,
        title: "First Lesson",
        durationSeconds: 300,
      });
      const l2 = await createLesson({
        courseId: course.id,
        title: "Second Lesson",
        durationSeconds: 600,
      });
      const l3 = await createLesson({
        courseId: course.id,
        title: "Third Lesson",
        durationSeconds: 900,
      });

      expect(l1.orderIndex).toBe(0);
      expect(l2.orderIndex).toBe(1);
      expect(l3.orderIndex).toBe(2);

      // Reorder l3 to the front: [l3, l1, l2]
      const reordered = await reorderLessons(course.id, [l3.id, l1.id, l2.id]);
      expect(reordered[0].id).toBe(l3.id);
      expect(reordered[0].orderIndex).toBe(0);
      expect(reordered[1].id).toBe(l1.id);
      expect(reordered[1].orderIndex).toBe(1);
      expect(reordered[2].id).toBe(l2.id);
      expect(reordered[2].orderIndex).toBe(2);

      // Update l2
      const updatedL2 = await updateLesson(l2.id, {
        title: "Updated Second Lesson",
        isPreview: true,
      });
      expect(updatedL2?.title).toBe("Updated Second Lesson");
      expect(updatedL2?.isPreview).toBe(true);
      expect(updatedL2?.id).toBe(l2.id); // Stable ID preserved
    });

    it("safeguards learner progress: prevents deletion when progress exists", async () => {
      const learner = await seedUser(testDb, { name: "Learner 1" });
      const lesson = await createLesson({
        courseId: course.id,
        title: "Protected Lesson",
      });

      // Seed learner progress for this lesson
      await seedLessonProgress(testDb, {
        userId: learner.id,
        courseId: course.id,
        lessonId: lesson.id,
        lessonSlug: lesson.slug,
        completed: true,
      });

      // Attempt to delete lesson
      const deleteResult = await deleteLesson(lesson.id);
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toContain("existing learner progress");

      // Verify lesson still exists in course
      const withLessons = await getCourseWithLessons(course.id);
      expect(withLessons?.lessons).toHaveLength(1);
      expect(withLessons?.lessons[0].id).toBe(lesson.id);
    });

    it("allows deletion when no progress exists and compacts orderIndex", async () => {
      const l1 = await seedLesson(testDb, { courseId: course.id, orderIndex: 0 });
      const l2 = await seedLesson(testDb, { courseId: course.id, orderIndex: 1 });
      const l3 = await seedLesson(testDb, { courseId: course.id, orderIndex: 2 });

      // Delete middle lesson (l2)
      const deleteResult = await deleteLesson(l2.id);
      expect(deleteResult.success).toBe(true);

      const withLessons = await getCourseWithLessons(course.id);
      expect(withLessons?.lessons).toHaveLength(2);
      expect(withLessons?.lessons[0].id).toBe(l1.id);
      expect(withLessons?.lessons[0].orderIndex).toBe(0);
      expect(withLessons?.lessons[1].id).toBe(l3.id);
      expect(withLessons?.lessons[1].orderIndex).toBe(1); // Compacted from 2 to 1
    });

    it("makes curriculum edits immediately visible in getCourseWithLessons queries", async () => {
      const lesson = await createLesson({
        courseId: course.id,
        title: "Original Lesson Title",
        durationSeconds: 400,
      });

      let fetched = await getCourseWithLessons(course.id);
      expect(fetched?.lessons[0].title).toBe("Original Lesson Title");
      expect(fetched?.readiness.totalDurationSeconds).toBe(400);

      // Edit title and duration
      await updateLesson(lesson.id, {
        title: "Refined Lesson Title",
        durationSeconds: 850,
      });

      fetched = await getCourseWithLessons(course.id);
      expect(fetched?.lessons[0].title).toBe("Refined Lesson Title");
      expect(fetched?.readiness.totalDurationSeconds).toBe(850);
    });

    it("rejects reordering when duplicate lesson IDs are supplied", async () => {
      const l1 = await createLesson({
        courseId: course.id,
        title: "Lesson Alpha",
      });
      await createLesson({
        courseId: course.id,
        title: "Lesson Beta",
      });

      // Passing duplicate l1.id instead of [l1.id, l2.id]
      await expect(
        reorderLessons(course.id, [l1.id, l1.id])
      ).rejects.toThrow("reorderLessons requires an array matching all existing lesson IDs");
    });

    it("prevents cross-course lesson deletion by enforcing expectedCourseId", async () => {
      const otherCourse = await seedCourse(testDb, {
        creatorId: creator.id,
        title: "Another Course",
      });
      const otherLesson = await createLesson({
        courseId: otherCourse.id,
        title: "Foreign Lesson",
      });

      // Attempt to delete foreign lesson passing course.id as expected course
      const res = await deleteLesson(otherLesson.id, course.id);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Lesson does not belong to the specified course");

      // Verify the foreign lesson is untouched
      const stillThere = await getCourseWithLessons(otherCourse.id);
      expect(stillThere?.lessons).toHaveLength(1);
      expect(stillThere?.lessons[0].id).toBe(otherLesson.id);
    });

    it("prevents cross-course lesson update by enforcing expectedCourseId", async () => {
      const otherCourse = await seedCourse(testDb, {
        creatorId: creator.id,
        title: "Another Course",
      });
      const otherLesson = await createLesson({
        courseId: otherCourse.id,
        title: "Foreign Lesson",
      });

      // Attempt to update foreign lesson passing course.id as expected course
      const res = await updateLesson(
        otherLesson.id,
        { title: "Hacked Lesson Title" },
        course.id
      );
      expect(res).toBeNull();

      // Verify the foreign lesson is untouched
      const stillThere = await getCourseWithLessons(otherCourse.id);
      expect(stillThere?.lessons[0].title).toBe("Foreign Lesson");
    });
  });
});
