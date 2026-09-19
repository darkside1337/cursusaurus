import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb, type TestDb } from "../helpers/db";
import { seedUser, seedCourse, seedLesson, seedLessonProgress } from "../helpers/fixtures";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteLesson } from "@/features/courses";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("Phase 4 Schema & Data Model Invariants", () => {
  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
  });

  it("persists video_key on the lessons table", async () => {
    const course = await seedCourse(testDb);
    const lesson = await seedLesson(testDb, {
      courseId: course.id,
      title: "Lesson with Video",
      videoKey: `${course.id}/lesson-1.mp4`,
    });

    const [retrieved] = await testDb
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lesson.id));

    expect(retrieved.videoKey).toBe(`${course.id}/lesson-1.mp4`);
  });

  it("enforces uniqueness on (user_id, lesson_id) in lesson_progress", async () => {
    const user = await seedUser(testDb);
    const course = await seedCourse(testDb);
    const lesson = await seedLesson(testDb, { courseId: course.id });

    // Seed first progress record
    await seedLessonProgress(testDb, {
      userId: user.id,
      courseId: course.id,
      lessonId: lesson.id,
      completed: true,
      lastPositionSeconds: 120,
    });

    // Attempting to insert a duplicate (userId, lessonId) record must violate the unique index
    await expect(
      testDb.insert(schema.lessonProgress).values({
        id: crypto.randomUUID(),
        userId: user.id,
        courseId: course.id,
        lessonId: lesson.id,
        completed: false,
        lastPositionSeconds: 50,
      })
    ).rejects.toThrow();
  });

  it("allows different users to have separate progress for the same lesson", async () => {
    const userA = await seedUser(testDb);
    const userB = await seedUser(testDb);
    const course = await seedCourse(testDb);
    const lesson = await seedLesson(testDb, { courseId: course.id });

    await seedLessonProgress(testDb, {
      userId: userA.id,
      courseId: course.id,
      lessonId: lesson.id,
      completed: true,
      lastPositionSeconds: 200,
    });

    await seedLessonProgress(testDb, {
      userId: userB.id,
      courseId: course.id,
      lessonId: lesson.id,
      completed: false,
      lastPositionSeconds: 40,
    });

    const rows = await testDb
      .select()
      .from(schema.lessonProgress)
      .where(eq(schema.lessonProgress.lessonId, lesson.id));

    expect(rows).toHaveLength(2);
  });

  it("blocks deleting a lesson that has learner progress rows", async () => {
    const user = await seedUser(testDb);
    const course = await seedCourse(testDb);
    const lesson = await seedLesson(testDb, { courseId: course.id });

    await seedLessonProgress(testDb, {
      userId: user.id,
      courseId: course.id,
      lessonId: lesson.id,
      completed: true,
    });

    const result = await deleteLesson(lesson.id, course.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain("progress");

    // Verify the lesson was not deleted
    const [stillExists] = await testDb
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lesson.id));
    expect(stillExists).toBeDefined();
  });
});
