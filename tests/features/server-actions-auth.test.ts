import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLesson,
  type TestDb,
} from "../helpers";
import {
  updateCourseMetadataAction,
  toggleCoursePublishAction,
  createLessonAction,
  deleteLessonAction,
  reorderLessonsAction,
} from "@/app/dashboard/courses/[id]/actions";
import { createCourseCheckoutSessionAction } from "@/features/purchases/actions";
import { createSubscriptionCheckoutSessionAction } from "@/features/subscriptions/actions";
import { recordLessonPlaybackAction, toggleLessonCompletionAction } from "@/features/progress/actions";

let testDb: TestDb;
let mockSessionUser: { id: string; email: string } | null = null;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("@/lib/auth", () => ({
  getServerSession: vi.fn(async () => {
    if (!mockSessionUser) return null;
    return {
      user: mockSessionUser,
      session: { id: "mock-sess-id", userId: mockSessionUser.id },
    };
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Spec 09: Server Actions Authorization & Service Audit", () => {
  let creatorA: { id: string; email: string };
  let creatorB: { id: string; email: string };
  let learner: { id: string; email: string };
  let courseA: { id: string; slug: string };
  let lessonA: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);

    creatorA = await seedUser(testDb, { name: "Creator A", email: "creator-a@test.com" });
    creatorB = await seedUser(testDb, { name: "Creator B", email: "creator-b@test.com" });
    learner = await seedUser(testDb, { name: "Learner User", email: "learner@test.com" });

    courseA = await seedCourse(testDb, {
      creatorId: creatorA.id,
      title: "Architecture & Design",
      priceCents: 4900,
      isPublished: true,
    });

    lessonA = await seedLesson(testDb, {
      courseId: courseA.id,
      title: "First Studio Lesson",
      orderIndex: 0,
      isPreview: true,
    });
  });

  describe("Creator Studio Actions Authorization", () => {
    it("rejects unauthenticated user (null session)", async () => {
      mockSessionUser = null;

      const res = await updateCourseMetadataAction(courseA.id, {
        title: "Hacked Title",
        priceDollars: 49,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/authentication required/i);
    });

    it("rejects non-owner user attempting to edit another creator's course", async () => {
      // Creator B logged in, trying to edit Creator A's course
      mockSessionUser = creatorB;

      const res = await updateCourseMetadataAction(courseA.id, {
        title: "Malicious Edit",
        priceDollars: 49,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not authorized/i);
    });

    it("rejects learner attempting to add lesson to a course", async () => {
      mockSessionUser = learner;

      const res = await createLessonAction(courseA.id, {
        title: "Unauthorized Lesson",
        description: "Exploit attempt",
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not authorized/i);
    });

    it("rejects non-owner attempting to delete a lesson", async () => {
      mockSessionUser = creatorB;

      const res = await deleteLessonAction(courseA.id, lessonA.id);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not authorized/i);
    });

    it("rejects non-owner attempting to reorder lessons", async () => {
      mockSessionUser = creatorB;

      const res = await reorderLessonsAction(courseA.id, [lessonA.id]);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not authorized/i);
    });

    it("rejects non-owner attempting to publish/unpublish", async () => {
      mockSessionUser = creatorB;

      const res = await toggleCoursePublishAction(courseA.id, false);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not authorized/i);
    });

    it("allows authorized creator to edit metadata", async () => {
      mockSessionUser = creatorA;

      const res = await updateCourseMetadataAction(courseA.id, {
        title: "Authorized Update",
        priceDollars: 59,
      });
      expect(res.success).toBe(true);
      expect(res.data?.title).toBe("Authorized Update");
    });
  });

  describe("Checkout Actions Authorization", () => {
    it("redirects unauthenticated user to login on course purchase checkout", async () => {
      mockSessionUser = null;

      const res = await createCourseCheckoutSessionAction(courseA.id);
      expect(res.error).toBe("unauthorized");
      expect(res.loginUrl).toContain("/login");
    });

    it("redirects unauthenticated user to login on subscription checkout", async () => {
      mockSessionUser = null;

      const res = await createSubscriptionCheckoutSessionAction();
      expect(res.error).toBe("unauthorized");
      expect(res.loginUrl).toContain("/login");
    });
  });

  describe("Progress Actions Authorization", () => {
    it("rejects unauthenticated user attempting to record playback", async () => {
      mockSessionUser = null;

      const res = await recordLessonPlaybackAction({
        courseId: courseA.id,
        lessonId: lessonA.id,
        positionSeconds: 120,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unauthorized/i);
    });

    it("rejects unauthenticated user attempting to toggle completion", async () => {
      mockSessionUser = null;

      const res = await toggleLessonCompletionAction({
        courseId: courseA.id,
        lessonId: lessonA.id,
        completed: true,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unauthorized/i);
    });
  });
});
