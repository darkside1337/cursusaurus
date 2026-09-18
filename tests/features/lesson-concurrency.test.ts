import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  type TestDb,
} from "../helpers";
import { lessons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLesson, reorderLessons } from "@/features/courses/actions";

let testDb: TestDb;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("P2-4: Lesson orderIndex Concurrency Protection", () => {
  let user: { id: string; email: string };
  let course: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "lesson-race@example.com" });
    course = await seedCourse(testDb, {
      creatorId: user.id,
      title: "Concurrent Lessons Course",
    });
  });

  it("assigns sequential, unique orderIndex under concurrent createLesson calls", async () => {
    const titles = ["Lesson Alpha", "Lesson Beta", "Lesson Gamma", "Lesson Delta"];

    // Launch multiple createLesson calls concurrently
    const createdLessons = await Promise.all(
      titles.map((title) =>
        createLesson({
          courseId: course.id,
          title,
          description: "Testing concurrent orderIndex assignment",
          durationSeconds: 120,
        })
      )
    );

    expect(createdLessons).toHaveLength(4);

    // Verify lessons in DB have indices [0, 1, 2, 3] with NO duplicates
    const dbLessons = await testDb
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, course.id))
      .orderBy(lessons.orderIndex);

    const orderIndices = dbLessons.map((l) => l.orderIndex);
    expect(orderIndices).toEqual([0, 1, 2, 3]);

    const uniqueIndices = new Set(orderIndices);
    expect(uniqueIndices.size).toBe(4);
  });

  it("reorderLessons still works without immediate unique constraint failure", async () => {
    // Create 3 lessons sequentially
    const l1 = await createLesson({ courseId: course.id, title: "L1" });
    const l2 = await createLesson({ courseId: course.id, title: "L2" });
    const l3 = await createLesson({ courseId: course.id, title: "L3" });

    // Reverse the order [l3, l2, l1]
    const reordered = await reorderLessons(course.id, [l3.id, l2.id, l1.id]);

    expect(reordered[0].id).toBe(l3.id);
    expect(reordered[0].orderIndex).toBe(0);
    expect(reordered[1].id).toBe(l2.id);
    expect(reordered[1].orderIndex).toBe(1);
    expect(reordered[2].id).toBe(l1.id);
    expect(reordered[2].orderIndex).toBe(2);
  });
});
