import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb, type TestDb } from "../helpers/db";
import {
  seedUser,
  seedCourse,
  seedLesson,
  seedEntitlement,
} from "../helpers/fixtures";
import {
  updateLessonProgress,
  setLessonCompletion,
  getLessonProgress,
  getCourseProgress,
  recordLessonPlaybackAction,
} from "@/features/progress";
import { updateLesson } from "@/features/courses";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

let mockSessionUser: { id: string } | null = null;
vi.mock("@/lib/auth", () => ({
  getServerSession: vi.fn(async () =>
    mockSessionUser ? { user: mockSessionUser } : null
  ),
}));

describe("Phase 4 Progress Engine & Completion Semantics", () => {
  let creator: { id: string };
  let learner: { id: string };
  let course: { id: string };
  let lesson100s: { id: string };
  let lesson1s: { id: string };
  let lessonNoDuration: { id: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    mockSessionUser = null;

    creator = await seedUser(testDb, { name: "Course Creator" });
    learner = await seedUser(testDb, { name: "Learner User" });

    course = await seedCourse(testDb, {
      creatorId: creator.id,
      title: "Interactive Systems",
    });

    lesson100s = await seedLesson(testDb, {
      courseId: course.id,
      title: "Lecture 100s",
      slug: "lecture-100s",
      durationSeconds: 100,
    });

    lesson1s = await seedLesson(testDb, {
      courseId: course.id,
      title: "Short Lecture 1s",
      slug: "lecture-1s",
      durationSeconds: 1,
    });

    lessonNoDuration = await seedLesson(testDb, {
      courseId: course.id,
      title: "Undated Lecture",
      slug: "lecture-no-duration",
      durationSeconds: null,
    });

    // Grant learner entitlement
    await seedEntitlement(testDb, {
      userId: learner.id,
      courseId: course.id,
      source: "purchase",
    });
  });

  it("Idempotency: repeated calls to updateLessonProgress update existing record without duplicating", async () => {
    const res1 = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 20,
    });

    const res2 = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 45,
    });

    expect(res2.id).toBe(res1.id);
    expect(res2.lastPositionSeconds).toBe(45);

    const rows = await testDb
      .select()
      .from(schema.lessonProgress)
      .where(
        and(
          eq(schema.lessonProgress.userId, learner.id),
          eq(schema.lessonProgress.lessonId, lesson100s.id)
        )
      );

    expect(rows).toHaveLength(1);
    expect(rows[0].lastPositionSeconds).toBe(45);
  });

  it("Position Clamping: clamps negative to 0 and caps at duration for positive duration lessons", async () => {
    // Negative position clamps to 0
    const clampedZero = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: -25,
    });
    expect(clampedZero.lastPositionSeconds).toBe(0);

    // Over duration clamps to 100
    const clampedMax = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 500,
    });
    expect(clampedMax.lastPositionSeconds).toBe(100);

    // Null duration lesson: clamp only to >= 0 floor
    const unconstrained = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lessonNoDuration.id,
      lastPositionSeconds: 350,
    });
    expect(unconstrained.lastPositionSeconds).toBe(350);
  });

  it("Auto-completion: triggers at 90% threshold for positive duration lessons", async () => {
    // 89s for 100s video -> threshold Math.ceil(90) = 90s, not yet complete
    const progress89 = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 89,
    });
    expect(progress89.completed).toBe(false);

    // 90s -> reaches 90% -> completed = true
    const progress90 = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 90,
    });
    expect(progress90.completed).toBe(true);
  });

  it("Short video edge case: 1s video does NOT auto-complete at position 0", async () => {
    // Math.ceil(1 * 0.9) = 1s; position 0 must NOT complete
    const progress0 = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson1s.id,
      lastPositionSeconds: 0,
    });
    expect(progress0.completed).toBe(false);

    // At position 1s -> completes
    const progress1 = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson1s.id,
      lastPositionSeconds: 1,
    });
    expect(progress1.completed).toBe(true);
  });

  it("Null duration lessons NEVER auto-complete from playback", async () => {
    const progress = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lessonNoDuration.id,
      lastPositionSeconds: 1000,
    });
    expect(progress.completed).toBe(false);
  });

  it("Sticky Auto-Completion: scrubbing backward does not unset completed", async () => {
    // First reach completion
    await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 95,
    });

    // Scrub back to 10s
    const scrubbed = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 10,
    });

    expect(scrubbed.lastPositionSeconds).toBe(10);
    expect(scrubbed.completed).toBe(true); // Retains completed state
  });

  it("Manual Toggle: setLessonCompletion is the only mechanism that unsets completed", async () => {
    // Complete lesson
    await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 95,
    });

    // Explicitly uncomplete
    const toggledOff = await setLessonCompletion({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      completed: false,
    });
    expect(toggledOff.completed).toBe(false);

    // Explicitly re-complete
    const toggledOn = await setLessonCompletion({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      completed: true,
    });
    expect(toggledOn.completed).toBe(true);
  });

  it("ended event forces completion on recordLessonPlaybackAction", async () => {
    mockSessionUser = learner;

    const res = await recordLessonPlaybackAction({
      courseId: course.id,
      lessonId: lesson100s.id,
      positionSeconds: 50,
      ended: true,
    });

    expect(res.success).toBe(true);
    expect(res.data?.completed).toBe(true);
    expect(res.data?.lastPositionSeconds).toBe(100);
  });

  it("Course Progress Summary: calculates percentage using total lessons count as denominator", async () => {
    // Currently 3 lessons in course (lesson100s, lesson1s, lessonNoDuration)
    // Mark 1 complete
    await setLessonCompletion({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      completed: true,
    });

    const summary1 = await getCourseProgress(learner.id, course.id);
    expect(summary1.totalLessonsCount).toBe(3);
    expect(summary1.completedLessonsCount).toBe(1);
    expect(summary1.percentage).toBe(33); // 1/3 = 33%

    // Mark second complete
    await setLessonCompletion({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson1s.id,
      completed: true,
    });

    const summary2 = await getCourseProgress(learner.id, course.id);
    expect(summary2.completedLessonsCount).toBe(2);
    expect(summary2.percentage).toBe(67); // 2/3 = 67%

    // Empty course returns 0%
    const emptyCourse = await seedCourse(testDb, { creatorId: creator.id });
    const emptySummary = await getCourseProgress(learner.id, emptyCourse.id);
    expect(emptySummary.totalLessonsCount).toBe(0);
    expect(emptySummary.percentage).toBe(0);
  });

  it("Progress Preservation (Invariant #6): Entitlement revocation does not delete lesson_progress rows", async () => {
    // Record progress
    await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 50,
    });

    // Revoke entitlement
    await testDb
      .update(schema.entitlements)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.entitlements.userId, learner.id),
          eq(schema.entitlements.courseId, course.id)
        )
      );

    // Verify progress row still exists in database
    const progress = await getLessonProgress(learner.id, course.id, lesson100s.id);
    expect(progress).not.toBeNull();
    expect(progress?.lastPositionSeconds).toBe(50);
  });

  it("Slug Renaming Resilience: Renaming a lesson slug preserves lessonId and all progress", async () => {
    await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 75,
    });

    // Rename the lesson's slug
    await updateLesson(lesson100s.id, { slug: "completely-new-renamed-slug" }, course.id);

    // Progress record is untouched because it keys on lessonId
    const progress = await getLessonProgress(learner.id, course.id, lesson100s.id);
    expect(progress).not.toBeNull();
    expect(progress?.lastPositionSeconds).toBe(75);
  });

  it("Creator Progress: Creator test progress is recorded under creator id and does not collide with learner", async () => {
    // Creator records progress
    const creatorProgress = await updateLessonProgress({
      userId: creator.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 60,
    });
    expect(creatorProgress.userId).toBe(creator.id);

    // Learner records progress on same lesson
    const learnerProgress = await updateLessonProgress({
      userId: learner.id,
      courseId: course.id,
      lessonId: lesson100s.id,
      lastPositionSeconds: 30,
    });
    expect(learnerProgress.userId).toBe(learner.id);

    // Verify independent progress
    const creatorCourseProg = await getCourseProgress(creator.id, course.id);
    const learnerCourseProg = await getCourseProgress(learner.id, course.id);

    expect(creatorCourseProg.lessons[lesson100s.id].lastPositionSeconds).toBe(60);
    expect(learnerCourseProg.lessons[lesson100s.id].lastPositionSeconds).toBe(30);
  });
});
