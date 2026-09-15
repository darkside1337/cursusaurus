export interface SignedPlaybackUrlInput {
  userId: string;
  courseId: string;
  lessonSlug: string;
  expiresInSeconds?: number;
}

export interface SignedPlaybackUrlResult {
  signedUrl: string;
  expiresAt: Date;
}
