import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLessonProgress,
  type TestDb,
} from "../helpers";
import {
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  publishCourse,
  unpublishCourse,
  getLessonById,
  getLessonBySlug,
  listLessonsByCourse,
  getCourseWithLessons,
  getCourseReadiness,
} from "@/features/courses";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("Chunk 2.1 — Lesson Domain & Readiness Invariants", () => {
  let creator: { id: string };
  let courseA: { id: string };
  let courseB: { id: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);

    creator = await seedUser(testDb, { name: "Creator 1" });
    courseA = await seedCourse(testDb, {
      creatorId: creator.id,
      title: "Design Systems Course",
      isPublished: false,
    });
    courseB = await seedCourse(testDb, {
      creatorId: creator.id,
      title: "Advanced Typography",
      isPublished: false,
    });
  });

  describe("Lesson Creation", () => {
    it("auto-increments orderIndex starting at 0", async () => {
      const lesson0 = await createLesson({
        courseId: courseA.id,
        title: "Introduction",
      });
      const lesson1 = await createLesson({
        courseId: courseA.id,
        title: "Color Tokens",
      });
      const lesson2 = await createLesson({
        courseId: courseA.id,
        title: "Typography Scale",
      });

      expect(lesson0.orderIndex).toBe(0);
      expect(lesson1.orderIndex).toBe(1);
      expect(lesson2.orderIndex).toBe(2);
    });

    it("generates kebab-case slug and prevents collisions within the same course", async () => {
      const l1 = await createLesson({
        courseId: courseA.id,
        title: "Getting Started",
      });
      const l2 = await createLesson({
        courseId: courseA.id,
        title: "Getting Started",
      });
      const l3 = await createLesson({
        courseId: courseA.id,
        title: "Getting Started",
      });

      expect(l1.slug).toBe("getting-started");
      expect(l2.slug).toBe("getting-started-2");
      expect(l3.slug).toBe("getting-started-3");
    });

    it("allows the same lesson slug in different courses", async () => {
      const lessonA = await createLesson({
        courseId: courseA.id,
        title: "Welcome Overview",
      });
      const lessonB = await createLesson({
        courseId: courseB.id,
        title: "Welcome Overview",
      });

      expect(lessonA.slug).toBe("welcome-overview");
      expect(lessonB.slug).toBe("welcome-overview");
    });

    it("supports optional metadata: isPreview and durationSeconds", async () => {
      const lesson = await createLesson({
        courseId: courseA.id,
        title: "Preview Lesson",
        durationSeconds: 420,
        isPreview: true,
        description: "Free preview for all visitors",
      });

      expect(lesson.isPreview).toBe(true);
      expect(lesson.durationSeconds).toBe(420);
      expect(lesson.description).toBe("Free preview for all visitors");
    });
  });

  describe("Lesson Updates", () => {
    it("updates lesson metadata while preserving orderIndex", async () => {
      const lesson = await createLesson({
        courseId: courseA.id,
        title: "Original Title",
        durationSeconds: 300,
        isPreview: false,
      });

      const updated = await updateLesson(lesson.id, {
        title: "Updated Title",
        durationSeconds: 600,
        isPreview: true,
        description: "New description",
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe("Updated Title");
      // Slug is preserved on title-only edits; explicit slugs still apply via updateLesson
      expect(updated?.slug).toBe(lesson.slug);
      expect(updated?.durationSeconds).toBe(600);
      expect(updated?.isPreview).toBe(true);
      expect(updated?.orderIndex).toBe(lesson.orderIndex);
    });

    it("returns null when updating non-existent lesson", async () => {
      const result = await updateLesson("non-existent-id", {
        title: "Does not exist",
      });
      expect(result).toBeNull();
    });
  });

  describe("Lesson Reordering", () => {
    it("reorders lessons transactionally and returns ordered list", async () => {
      const l0 = await createLesson({ courseId: courseA.id, title: "Lesson 0" });
      const l1 = await createLesson({ courseId: courseA.id, title: "Lesson 1" });
      const l2 = await createLesson({ courseId: courseA.id, title: "Lesson 2" });

      // Swap to: l2, l0, l1
      const reordered = await reorderLessons(courseA.id, [l2.id, l0.id, l1.id]);

      expect(reordered).toHaveLength(3);
      expect(reordered[0].id).toBe(l2.id);
      expect(reordered[0].orderIndex).toBe(0);
      expect(reordered[1].id).toBe(l0.id);
      expect(reordered[1].orderIndex).toBe(1);
      expect(reordered[2].id).toBe(l1.id);
      expect(reordered[2].orderIndex).toBe(2);

      // Verify direct query order
      const fetched = await listLessonsByCourse(courseA.id);
      expect(fetched.map((l) => l.id)).toEqual([l2.id, l0.id, l1.id]);
    });

    it("throws error if reorder list does not match all existing lesson IDs", async () => {
      const l0 = await createLesson({ courseId: courseA.id, title: "Lesson 0" });
      await createLesson({ courseId: courseA.id, title: "Lesson 1" });

      await expect(
        reorderLessons(courseA.id, [l0.id])
      ).rejects.toThrow("reorderLessons requires an array matching all existing lesson IDs");

      await expect(
        reorderLessons(courseA.id, [l0.id, "random-foreign-id"])
      ).rejects.toThrow("reorderLessons requires an array matching all existing lesson IDs");
    });
  });

  describe("Lesson Deletion & Invariant Safeguards", () => {
    it("deletes lesson and re-compacts subsequent orderIndex positions when no progress exists", async () => {
      const l0 = await createLesson({ courseId: courseA.id, title: "Lesson 0" });
      const l1 = await createLesson({ courseId: courseA.id, title: "Lesson 1" });
      const l2 = await createLesson({ courseId: courseA.id, title: "Lesson 2" });

      // Delete middle lesson (l1)
      const res = await deleteLesson(l1.id);
      expect(res.success).toBe(true);

      const remaining = await listLessonsByCourse(courseA.id);
      expect(remaining).toHaveLength(2);
      expect(remaining[0].id).toBe(l0.id);
      expect(remaining[0].orderIndex).toBe(0);
      expect(remaining[1].id).toBe(l2.id);
      expect(remaining[1].orderIndex).toBe(1); // Cleanly recompacted from 2 to 1
    });

    it("INVARIANT SAFEGUARD: blocks deletion when learner progress exists", async () => {
      const learner = await seedUser(testDb, { name: "Learner User" });
      const lesson = await createLesson({
        courseId: courseA.id,
        title: "Important Lesson",
      });

      // Seed progress for learner
      await seedLessonProgress(testDb, {
        userId: learner.id,
        courseId: courseA.id,
        lessonId: lesson.id,
        lessonSlug: lesson.slug,
        completed: true,
        lastPositionSeconds: 120,
      });

      // Attempt deletion
      const deleteResult = await deleteLesson(lesson.id);

      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toContain("Cannot delete lesson with existing learner progress");

      // Verify lesson still exists in database
      const stillExists = await getLessonById(lesson.id);
      expect(stillExists).not.toBeNull();
      expect(stillExists?.id).toBe(lesson.id);
    });

    it("returns error when attempting to delete non-existent lesson", async () => {
      const result = await deleteLesson("unknown-id");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Lesson not found");
    });
  });

  describe("Course Readiness & Purchase Eligibility Invariants", () => {
    it("evaluates draft course as not purchase eligible (status: draft)", async () => {
      // courseA is unpublished, 0 lessons
      const readinessEmpty = await getCourseReadiness(courseA.id);
      expect(readinessEmpty).toEqual({
        isPublished: false,
        isPurchaseEligible: false,
        status: "draft",
        lessonCount: 0,
        totalDurationSeconds: 0,
      });

      // Add lessons to draft course
      await createLesson({
        courseId: courseA.id,
        title: "Lesson 1",
        durationSeconds: 300,
      });
      const readinessWithLessons = await getCourseReadiness(courseA.id);
      expect(readinessWithLessons).toEqual({
        isPublished: false,
        isPurchaseEligible: false,
        status: "draft",
        lessonCount: 1,
        totalDurationSeconds: 300,
      });
    });

    it("evaluates published course with 0 lessons as not purchase eligible (status: no_lessons)", async () => {
      await publishCourse(courseA.id);

      const readiness = await getCourseReadiness(courseA.id);
      expect(readiness).toEqual({
        isPublished: true,
        isPurchaseEligible: false,
        status: "no_lessons",
        lessonCount: 0,
        totalDurationSeconds: 0,
      });
    });

    it("evaluates published course with 1+ lessons as purchase eligible (status: ready)", async () => {
      await publishCourse(courseA.id);
      await createLesson({
        courseId: courseA.id,
        title: "Module 1",
        durationSeconds: 500,
      });
      await createLesson({
        courseId: courseA.id,
        title: "Module 2",
        durationSeconds: 700,
      });

      const readiness = await getCourseReadiness(courseA.id);
      expect(readiness).toEqual({
        isPublished: true,
        isPurchaseEligible: true,
        status: "ready",
        lessonCount: 2,
        totalDurationSeconds: 1200,
      });
    });

    it("getCourseWithLessons bundles course metadata, ordered lessons, and readiness", async () => {
      await publishCourse(courseA.id);
      const l1 = await createLesson({
        courseId: courseA.id,
        title: "First Steps",
        durationSeconds: 240,
      });

      const fullCourse = await getCourseWithLessons(courseA.id);
      expect(fullCourse).not.toBeNull();
      expect(fullCourse?.id).toBe(courseA.id);
      expect(fullCourse?.lessons).toHaveLength(1);
      expect(fullCourse?.lessons[0].id).toBe(l1.id);
      expect(fullCourse?.readiness.isPurchaseEligible).toBe(true);
      expect(fullCourse?.readiness.status).toBe("ready");
    });
  });

  describe("Course Publish and Unpublish Transitions", () => {
    it("toggles course publication state correctly", async () => {
      const published = await publishCourse(courseA.id);
      expect(published?.isPublished).toBe(true);

      const unpublished = await unpublishCourse(courseA.id);
      expect(unpublished?.isPublished).toBe(false);
    });
  });

  describe("Queries", () => {
    it("retrieves lesson by ID and by courseId + slug", async () => {
      const lesson = await createLesson({
        courseId: courseA.id,
        title: "Unique Title",
      });

      const byId = await getLessonById(lesson.id);
      expect(byId?.id).toBe(lesson.id);

      const bySlug = await getLessonBySlug(courseA.id, "unique-title");
      expect(bySlug?.id).toBe(lesson.id);

      const wrongCourseSlug = await getLessonBySlug(courseB.id, "unique-title");
      expect(wrongCourseSlug).toBeNull();
    });
  });
});
