import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb, type TestDb } from "../helpers/db";
import { seedUser, seedCourse, seedLesson, seedEntitlement } from "../helpers/fixtures";
import { getSignedPlaybackUrl } from "@/features/video";
import { GET as signedUrlRouteHandler } from "@/app/api/video/signed-url/route";
import { NextRequest } from "next/server";

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

const mockCreateSignedUrl = vi.fn(async (path: string, expiresIn: number) => ({
  data: { signedUrl: `https://storage.supabase.co/signed/${path}?exp=${expiresIn}` },
  error: null,
}));

vi.mock("@/lib/storage", () => ({
  getStorageClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}));

describe("Phase 4 Signed Playback URLs Matrix", () => {
  let creator: { id: string };
  let learner: { id: string };
  let course: { id: string };
  let publishedLesson: { id: string };
  let previewLesson: { id: string };
  let noVideoLesson: { id: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    mockCreateSignedUrl.mockClear();
    mockSessionUser = null;

    creator = await seedUser(testDb, { name: "Course Creator" });
    learner = await seedUser(testDb, { name: "Enrolled Learner" });

    course = await seedCourse(testDb, {
      creatorId: creator.id,
      title: "Design Systems",
      isPublished: true,
    });

    publishedLesson = await seedLesson(testDb, {
      courseId: course.id,
      title: "01 - Tokens",
      videoKey: `${course.id}/lesson-1.mp4`,
      isPreview: false,
    });

    previewLesson = await seedLesson(testDb, {
      courseId: course.id,
      title: "00 - Intro",
      videoKey: `${course.id}/lesson-0.mp4`,
      isPreview: true,
    });

    noVideoLesson = await seedLesson(testDb, {
      courseId: course.id,
      title: "02 - In Progress",
      videoKey: null,
      isPreview: false,
    });
  });

  it("Contract 200 OK: Entitled learner receives signed URL and expiration", async () => {
    // Grant purchase entitlement to learner
    await seedEntitlement(testDb, {
      userId: learner.id,
      courseId: course.id,
      source: "purchase",
    });

    const result = await getSignedPlaybackUrl({
      userId: learner.id,
      courseId: course.id,
      lessonId: publishedLesson.id,
      expiresInSeconds: 60,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.signedUrl).toContain("lesson-1.mp4");
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("Contract 200 no_video: Entitled learner requesting lesson without video gets status no_video", async () => {
    await seedEntitlement(testDb, {
      userId: learner.id,
      courseId: course.id,
      source: "purchase",
    });

    const result = await getSignedPlaybackUrl({
      userId: learner.id,
      courseId: course.id,
      lessonId: noVideoLesson.id,
    });

    expect(result.status).toBe("no_video");
  });

  it("Contract 401 unauthenticated: Guest caller requesting paid lesson returns unauthenticated", async () => {
    const result = await getSignedPlaybackUrl({
      courseId: course.id,
      lessonId: publishedLesson.id,
    });

    expect(result.status).toBe("unauthenticated");
  });

  it("Contract 403 forbidden: Authenticated learner without entitlement returns forbidden", async () => {
    const unentitledUser = await seedUser(testDb, { name: "Non-enrolled User" });

    const result = await getSignedPlaybackUrl({
      userId: unentitledUser.id,
      courseId: course.id,
      lessonId: publishedLesson.id,
    });

    expect(result.status).toBe("forbidden");
  });

  it("Contract 404 not_found: Invalid lesson or mismatched course/lesson pairing", async () => {
    const otherCourse = await seedCourse(testDb, { creatorId: creator.id });

    // Lesson does not exist
    const res1 = await getSignedPlaybackUrl({
      userId: learner.id,
      courseId: course.id,
      lessonId: "non-existent-id",
    });
    expect(res1.status).toBe("not_found");

    // Lesson belongs to course, but caller asked for otherCourse
    const res2 = await getSignedPlaybackUrl({
      userId: learner.id,
      courseId: otherCourse.id,
      lessonId: publishedLesson.id,
    });
    expect(res2.status).toBe("not_found");
  });

  it("Contract 404 not_found: Unpublished draft course requested by non-creator (anti-enumeration)", async () => {
    const draftCourse = await seedCourse(testDb, {
      creatorId: creator.id,
      isPublished: false,
    });

    const draftLesson = await seedLesson(testDb, {
      courseId: draftCourse.id,
      videoKey: `${draftCourse.id}/draft.mp4`,
    });

    // Learner requesting draft course returns not_found (not forbidden or unauthorized)
    const result = await getSignedPlaybackUrl({
      userId: learner.id,
      courseId: draftCourse.id,
      lessonId: draftLesson.id,
    });

    expect(result.status).toBe("not_found");
  });

  it("Preview Exemption: Unauthenticated guest requesting preview lesson receives 200 OK", async () => {
    const result = await getSignedPlaybackUrl({
      courseId: course.id,
      lessonId: previewLesson.id,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.signedUrl).toContain("lesson-0.mp4");
    }
  });

  it("Creator Access: Creator can stream paid lessons without a purchase or subscription entitlement", async () => {
    const result = await getSignedPlaybackUrl({
      userId: creator.id,
      courseId: course.id,
      lessonId: publishedLesson.id,
    });

    expect(result.status).toBe("ok");
  });

  it("Route Handler: GET /api/video/signed-url returns expected HTTP status codes", async () => {
    // 1. Missing query params -> 400
    const req1 = new NextRequest("http://localhost:3000/api/video/signed-url");
    const res1 = await signedUrlRouteHandler(req1);
    expect(res1.status).toBe(400);

    // 2. Unauthenticated requesting paid -> 401
    mockSessionUser = null;
    const req2 = new NextRequest(
      `http://localhost:3000/api/video/signed-url?courseId=${course.id}&lessonId=${publishedLesson.id}`
    );
    const res2 = await signedUrlRouteHandler(req2);
    expect(res2.status).toBe(401);

    // 3. Unauthenticated requesting preview -> 200 ok
    const req3 = new NextRequest(
      `http://localhost:3000/api/video/signed-url?courseId=${course.id}&lessonId=${previewLesson.id}`
    );
    const res3 = await signedUrlRouteHandler(req3);
    expect(res3.status).toBe(200);
    const data3 = await res3.json();
    expect(data3.status).toBe("ok");

    // 4. Authenticated without entitlement -> 403
    mockSessionUser = learner;
    const req4 = new NextRequest(
      `http://localhost:3000/api/video/signed-url?courseId=${course.id}&lessonId=${publishedLesson.id}`
    );
    const res4 = await signedUrlRouteHandler(req4);
    expect(res4.status).toBe(403);

    // 5. Authenticated with entitlement -> 200 ok
    await seedEntitlement(testDb, {
      userId: learner.id,
      courseId: course.id,
      source: "purchase",
    });
    const res5 = await signedUrlRouteHandler(req4);
    expect(res5.status).toBe(200);
    const data5 = await res5.json();
    expect(data5.status).toBe("ok");
    expect(data5.signedUrl).toBeDefined();

    // 6. Entitled but no video -> 200 no_video
    const req6 = new NextRequest(
      `http://localhost:3000/api/video/signed-url?courseId=${course.id}&lessonId=${noVideoLesson.id}`
    );
    const res6 = await signedUrlRouteHandler(req6);
    expect(res6.status).toBe(200);
    const data6 = await res6.json();
    expect(data6.status).toBe("no_video");
  });
});
