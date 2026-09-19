import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb, type TestDb } from "../helpers/db";
import { seedUser, seedCourse, seedLesson } from "../helpers/fixtures";
import {
  getLessonVideoUploadUrl,
  saveLessonVideoAsset,
  MAX_VIDEO_BYTES,
} from "@/features/video";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

let mockFileSize = 10 * 1024 * 1024; // 10MB default
const mockCreateSignedUploadUrl = vi.fn(async (path: string) => ({
  data: { signedUrl: `https://storage.supabase.co/upload/${path}`, token: "mock-upload-token" },
  error: null,
}));
const mockInfo = vi.fn<
  () => Promise<{ data: { size: number; mimetype: string } | null; error: Error | null }>
>(async () => ({
  data: { size: mockFileSize, mimetype: "video/mp4" },
  error: null,
}));

vi.mock("@/lib/storage", () => ({
  getStorageClient: () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
        info: mockInfo,
      }),
    },
  }),
}));

describe("Phase 4 Video Upload Flow & Storage Hardening", () => {
  let creator: { id: string };
  let nonCreator: { id: string };
  let course: { id: string };
  let lesson: { id: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    mockCreateSignedUploadUrl.mockClear();
    mockInfo.mockClear();
    mockFileSize = 10 * 1024 * 1024;

    creator = await seedUser(testDb, { name: "Creator User" });
    nonCreator = await seedUser(testDb, { name: "Random User" });

    course = await seedCourse(testDb, {
      creatorId: creator.id,
      title: "Mastering Typography",
    });

    lesson = await seedLesson(testDb, {
      courseId: course.id,
      title: "Lesson 1",
      videoKey: null,
      durationSeconds: null,
    });
  });

  it("derives canonical storage path `${courseId}/${lessonId}.${extension}` for whitelisted extensions", async () => {
    const result = await getLessonVideoUploadUrl({
      userId: creator.id,
      courseId: course.id,
      lessonId: lesson.id,
      extension: "mp4",
    });

    const expectedPath = `${course.id}/${lesson.id}.mp4`;
    expect(result.videoKey).toBe(expectedPath);
    expect(result.token).toBe("mock-upload-token");
    expect(result.uploadUrl).toContain(expectedPath);
  });

  it("rejects non-creators from generating upload URLs", async () => {
    await expect(
      getLessonVideoUploadUrl({
        userId: nonCreator.id,
        courseId: course.id,
        lessonId: lesson.id,
        extension: "mp4",
      })
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("commits server-derived videoKey and duration on saveLessonVideoAsset", async () => {
    const saveResult = await saveLessonVideoAsset({
      userId: creator.id,
      courseId: course.id,
      lessonId: lesson.id,
      extension: "mp4",
      durationSeconds: 420,
    });

    const expectedKey = `${course.id}/${lesson.id}.mp4`;
    expect(saveResult.videoKey).toBe(expectedKey);

    // Verify row updated in DB
    const [updated] = await testDb
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lesson.id));

    expect(updated.videoKey).toBe(expectedKey);
    expect(updated.durationSeconds).toBe(420);
  });

  it("rejects non-creators from saving video assets", async () => {
    await expect(
      saveLessonVideoAsset({
        userId: nonCreator.id,
        courseId: course.id,
        lessonId: lesson.id,
        extension: "mp4",
        durationSeconds: 300,
      })
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("rejects video assets exceeding the 50 MB size limit", async () => {
    mockFileSize = MAX_VIDEO_BYTES + 1024; // 50MB + 1KB

    await expect(
      saveLessonVideoAsset({
        userId: creator.id,
        courseId: course.id,
        lessonId: lesson.id,
        extension: "mp4",
        durationSeconds: 300,
      })
    ).rejects.toThrow(/exceeds maximum allowed size of 50 MB/i);

    // Verify videoKey was not set in DB
    const [unchanged] = await testDb
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lesson.id));

    expect(unchanged.videoKey).toBeNull();
  });

  it("rejects saving video if object does not exist in storage", async () => {
    mockInfo.mockResolvedValueOnce({
      data: null,
      error: new Error("Object not found"),
    });

    await expect(
      saveLessonVideoAsset({
        userId: creator.id,
        courseId: course.id,
        lessonId: lesson.id,
        extension: "mp4",
        durationSeconds: 300,
      })
    ).rejects.toThrow(/does not exist in storage/i);
  });
});
