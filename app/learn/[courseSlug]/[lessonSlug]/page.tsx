import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { getCourseBySlug, listLessonsByCourse } from "@/features/courses";
import { hasAccess } from "@/features/entitlements/access";
import { getCourseProgress } from "@/features/progress";
import { PlayerView } from "./player-view";

interface LearnPageProps {
  params: Promise<{
    courseSlug: string;
    lessonSlug: string;
  }>;
}

export default async function LearnLessonPage({ params }: LearnPageProps) {
  const { courseSlug, lessonSlug } = await params;

  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=/learn/${encodeURIComponent(courseSlug)}/${encodeURIComponent(lessonSlug)}`
    );
  }

  const userId = session.user.id;

  const course = await getCourseBySlug(courseSlug);
  if (!course) {
    notFound();
  }

  // Anti-enumeration: draft courses accessible only to creator
  if (!course.isPublished && course.creatorId !== userId) {
    notFound();
  }

  const courseLessons = await listLessonsByCourse(course.id);
  const currentLesson = courseLessons.find((l) => l.slug === lessonSlug);

  if (!currentLesson) {
    notFound();
  }

  // Determine access status (Invariant #1: hasAccess reads only from entitlements)
  const isCreator = course.creatorId === userId;
  const isEnrolled = isCreator || (await hasAccess(userId, course.id));
  const isUnlocked = isEnrolled || currentLesson.isPreview;

  // Fetch course progress summary
  const progress = await getCourseProgress(userId, course.id);

  // Sequential navigation
  const currentIndex = courseLessons.findIndex((l) => l.id === currentLesson.id);
  const previousLesson =
    currentIndex > 0
      ? {
          title: courseLessons[currentIndex - 1].title,
          slug: courseLessons[currentIndex - 1].slug,
        }
      : null;
  const nextLesson =
    currentIndex < courseLessons.length - 1
      ? {
          title: courseLessons[currentIndex + 1].title,
          slug: courseLessons[currentIndex + 1].slug,
        }
      : null;

  // Strict client data boundary:
  // videoKey and raw storage paths are NEVER passed down to client props.
  const sanitizedAllLessons = courseLessons.map((l) => ({
    id: l.id,
    title: l.title,
    slug: l.slug,
    description: l.description,
    durationSeconds: l.durationSeconds,
    orderIndex: l.orderIndex,
    isPreview: l.isPreview,
  }));

  const sanitizedCurrentLesson = {
    id: currentLesson.id,
    title: currentLesson.title,
    slug: currentLesson.slug,
    description: currentLesson.description,
    durationSeconds: currentLesson.durationSeconds,
    orderIndex: currentLesson.orderIndex,
    isPreview: currentLesson.isPreview,
  };

  return (
    <PlayerView
      course={{
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
      }}
      currentLesson={sanitizedCurrentLesson}
      allLessons={sanitizedAllLessons}
      isUnlocked={isUnlocked}
      isCourseEnrolled={isEnrolled}
      initialProgress={progress}
      previousLesson={previousLesson}
      nextLesson={nextLesson}
    />
  );
}
