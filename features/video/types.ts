export type SupportedVideoExtension = "mp4" | "webm" | "mov";

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const VIDEO_BUCKET = "course-videos" as const;

export interface GetUploadUrlInput {
  userId: string;
  courseId: string;
  lessonId: string;
  extension: SupportedVideoExtension;
}

export interface UploadUrlResult {
  uploadUrl: string;
  token: string;
  videoKey: string;
}

export interface SaveLessonVideoInput {
  userId: string;
  courseId: string;
  lessonId: string;
  extension: SupportedVideoExtension;
  durationSeconds: number;
}

export interface SignedPlaybackUrlInput {
  userId?: string;
  courseId: string;
  lessonId: string;
  expiresInSeconds?: number;
}

export type SignedPlaybackUrlResult =
  | { status: "ok"; signedUrl: string; expiresAt: Date }
  | { status: "no_video" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "not_found" };
