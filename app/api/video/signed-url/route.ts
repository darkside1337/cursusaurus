import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getSignedPlaybackUrl } from "@/features/video";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const courseId = searchParams.get("courseId");
  const lessonId = searchParams.get("lessonId");

  if (!courseId || !lessonId) {
    return NextResponse.json(
      { error: "courseId and lessonId are required query parameters" },
      { status: 400 }
    );
  }

  const session = await getServerSession();
  const userId = session?.user?.id;

  try {
    const result = await getSignedPlaybackUrl({
      userId,
      courseId,
      lessonId,
    });

    switch (result.status) {
      case "ok":
        return NextResponse.json(
          {
            status: "ok",
            signedUrl: result.signedUrl,
            expiresAt: result.expiresAt.toISOString(),
          },
          { status: 200 }
        );
      case "no_video":
        return NextResponse.json({ status: "no_video" }, { status: 200 });
      case "unauthenticated":
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      case "forbidden":
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      case "not_found":
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
