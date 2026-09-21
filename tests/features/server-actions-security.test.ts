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
  reorderLessonsAction,
  getLessonVideoUploadUrlAction,
  saveLessonVideoAssetAction,
} from "@/app/dashboard/courses/[id]/actions";
import { recordLessonPlaybackAction } from "@/features/progress/actions";
import { createSubscriptionCheckoutSessionAction } from "@/features/subscriptions/actions";
import { createCourseCheckoutSessionAction } from "@/features/purchases/actions";
import { subscriptions, purchases } from "@/lib/db/schema";
import * as coursesFeature from "@/features/courses";

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

describe("Server Actions Security Hardening", () => {
  let creatorA: { id: string; email: string };
  let creatorB: { id: string; email: string };
  let courseA: { id: string; slug: string };
  let lessonA: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);

    creatorA = await seedUser(testDb, { name: "Creator A", email: "creator-a@test.com" });
    creatorB = await seedUser(testDb, { name: "Creator B", email: "creator-b@test.com" });

    courseA = await seedCourse(testDb, {
      creatorId: creatorA.id,
      title: "Security Masterclass",
      priceCents: 4900,
      isPublished: true,
    });

    lessonA = await seedLesson(testDb, {
      courseId: courseA.id,
      title: "Lesson 1",
      orderIndex: 0,
      durationSeconds: 300,
    });
  });

  describe("Authentication Guard", () => {
    it("rejects unauthenticated calls to getLessonVideoUploadUrlAction", async () => {
      mockSessionUser = null;
      const res = await getLessonVideoUploadUrlAction(courseA.id, lessonA.id, "mp4");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Authentication required");
    });

    it("rejects unauthenticated calls to saveLessonVideoAssetAction", async () => {
      mockSessionUser = null;
      const res = await saveLessonVideoAssetAction(courseA.id, lessonA.id, "mp4", 120);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Authentication required");
    });

    it("rejects unauthenticated calls to updateCourseMetadataAction", async () => {
      mockSessionUser = null;
      const res = await updateCourseMetadataAction(courseA.id, {
        title: "New Title",
        priceDollars: 49,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Authentication required");
    });

    it("rejects unauthenticated calls to recordLessonPlaybackAction", async () => {
      mockSessionUser = null;
      const res = await recordLessonPlaybackAction({
        courseId: courseA.id,
        lessonId: lessonA.id,
        positionSeconds: 60,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Authentication required");
    });
  });

  describe("Domain Authorization Boundaries (H1 / H2)", () => {
    it("rejects non-owner requesting video upload URL (H1)", async () => {
      mockSessionUser = creatorB;
      const res = await getLessonVideoUploadUrlAction(courseA.id, lessonA.id, "mp4");
      expect(res.success).toBe(false);
      expect(res.error).toBe("You are not authorized to edit this course");
    });

    it("rejects non-owner saving video asset (H2)", async () => {
      mockSessionUser = creatorB;
      const res = await saveLessonVideoAssetAction(courseA.id, lessonA.id, "mp4", 120);
      expect(res.success).toBe(false);
      expect(res.error).toBe("You are not authorized to edit this course");
    });
  });

  describe("Thumbnail URL Protocol Validation (M2)", () => {
    beforeEach(() => {
      mockSessionUser = creatorA;
    });

    it("rejects HTTP thumbnail URL", async () => {
      const res = await updateCourseMetadataAction(courseA.id, {
        title: "Valid Title",
        priceDollars: 49,
        thumbnailUrl: "http://example.com/image.png",
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/HTTPS protocol/i);
    });

    it("rejects javascript: pseudo-protocol", async () => {
      const res = await updateCourseMetadataAction(courseA.id, {
        title: "Valid Title",
        priceDollars: 49,
        thumbnailUrl: "javascript:alert(1)",
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Invalid URL format|HTTPS protocol/i);
    });

    it("rejects data: URIs", async () => {
      const res = await updateCourseMetadataAction(courseA.id, {
        title: "Valid Title",
        priceDollars: 49,
        thumbnailUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/HTTPS protocol/i);
    });

    it("accepts valid HTTPS thumbnail URL", async () => {
      const res = await updateCourseMetadataAction(courseA.id, {
        title: "Valid Title",
        priceDollars: 49,
        thumbnailUrl: "https://example.com/image.png",
      });
      expect(res.success).toBe(true);
      expect(res.data?.thumbnailUrl).toBe("https://example.com/image.png");
    });
  });

  describe("Playback Position Validation (M5)", () => {
    beforeEach(() => {
      mockSessionUser = creatorA;
    });

    it("rejects NaN positionSeconds before executing DB logic", async () => {
      const res = await recordLessonPlaybackAction({
        courseId: courseA.id,
        lessonId: lessonA.id,
        positionSeconds: Number.NaN,
        ended: true,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/finite number|invalid/i);
    });

    it("rejects Infinity positionSeconds", async () => {
      const res = await recordLessonPlaybackAction({
        courseId: courseA.id,
        lessonId: lessonA.id,
        positionSeconds: Number.POSITIVE_INFINITY,
        ended: true,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/finite number|Infinity/i);
    });

    it("rejects negative positionSeconds", async () => {
      const res = await recordLessonPlaybackAction({
        courseId: courseA.id,
        lessonId: lessonA.id,
        positionSeconds: -10,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/cannot be negative/i);
    });

    it("rejects fractional positionSeconds", async () => {
      const res = await recordLessonPlaybackAction({
        courseId: courseA.id,
        lessonId: lessonA.id,
        positionSeconds: 12.5,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/must be an integer/i);
    });
  });

  describe("Lesson Reordering Array Limit (L2)", () => {
    beforeEach(() => {
      mockSessionUser = creatorA;
    });

    it("rejects lessonIds array exceeding 200 items", async () => {
      const oversizedArray = Array.from({ length: 201 }, (_, i) => `lesson-id-${i}`);
      const res = await reorderLessonsAction(courseA.id, oversizedArray);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Cannot reorder more than 200 lessons at once");
    });
  });

  describe("Error Sanitization & Masking (M4)", () => {
    beforeEach(() => {
      mockSessionUser = creatorA;
    });

    it("surfaces intentional ActionError message to client", async () => {
      // Price under $19 throws intentional ActionError
      const res = await updateCourseMetadataAction(courseA.id, {
        title: "Valid Title",
        priceDollars: 10,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Price must be between $19 and $199");
    });

    it("replaces unexpected DB/runtime errors with generic message and does not leak SQL", async () => {
      const spy = vi
        .spyOn(coursesFeature, "updateCourse")
        .mockRejectedValueOnce(new Error("FATAL: relation \"courses\" violates foreign key constraint error in PostgreSQL query"));

      const res = await updateCourseMetadataAction(courseA.id, {
        title: "Valid Title",
        priceDollars: 49,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("An unexpected error occurred. Please try again.");
      expect(res.error).not.toMatch(/PostgreSQL|relation|courses|constraint/i);

      spy.mockRestore();
    });
  });

  describe("Business Invariants (Not Rate Limiting)", () => {
    it("redirects user with active subscription from creating another subscription checkout (Invariant #11)", async () => {
      mockSessionUser = creatorA;

      await testDb.insert(subscriptions).values({
        id: crypto.randomUUID(),
        userId: creatorA.id,
        stripeSubscriptionId: "sub_mock_active",
        stripeCustomerId: "cus_mock_active",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      const res = await createSubscriptionCheckoutSessionAction();
      expect(res.redirectTo).toBe("/billing");
    });

    it("prevents already-owned course purchase checkout (Invariant #12)", async () => {
      mockSessionUser = creatorA;

      await testDb.insert(purchases).values({
        id: crypto.randomUUID(),
        userId: creatorA.id,
        courseId: courseA.id,
        pricePaidCents: 4900,
        stripePaymentIntentId: "pi_mock_123",
        status: "completed",
      });

      const res = await createCourseCheckoutSessionAction(courseA.id);
      expect(res.error).toBe("You already own this course monograph.");
    });
  });
});
