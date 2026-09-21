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

// Strict client data boundary:
// videoKey and raw storage paths are NEVER included in this shape.
function sanitizeLesson(l: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationSeconds: number | null;
  orderIndex: number;
  isPreview: boolean;
}) {
  return {
    id: l.id,
    title: l.title,
    slug: l.slug,
    description: l.description,
    durationSeconds: l.durationSeconds,
    orderIndex: l.orderIndex,
    isPreview: l.isPreview,
  };
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

  const isCreator = course.creatorId === userId;

  // Parallelise independent DB calls: lesson list, access check, progress
  const [courseLessons, isEnrolledRaw, progress] = await Promise.all([
    listLessonsByCourse(course.id),
    isCreator ? Promise.resolve(true) : hasAccess(userId, course.id),
    getCourseProgress(userId, course.id),
  ]);

  const isEnrolled = isCreator || isEnrolledRaw;

  const sanitizedAllLessons = courseLessons.map(sanitizeLesson);
  const sanitizedCurrentLesson = sanitizedAllLessons.find(
    (l) => l.slug === lessonSlug
  );

  if (!sanitizedCurrentLesson) {
    notFound();
  }

  const isUnlocked = isEnrolled || sanitizedCurrentLesson.isPreview;

  // Sequential navigation
  const currentIndex = sanitizedAllLessons.findIndex(
    (l) => l.id === sanitizedCurrentLesson.id
  );
  const previousLesson =
    currentIndex > 0
      ? {
          title: sanitizedAllLessons[currentIndex - 1].title,
          slug: sanitizedAllLessons[currentIndex - 1].slug,
        }
      : null;
  const nextLesson =
    currentIndex < sanitizedAllLessons.length - 1
      ? {
          title: sanitizedAllLessons[currentIndex + 1].title,
          slug: sanitizedAllLessons[currentIndex + 1].slug,
        }
      : null;

  // Derive curriculum duration label server-side so the client never has to
  const totalCurriculumSeconds = courseLessons.reduce(
    (acc, l) => acc + (l.durationSeconds ?? 0),
    0
  );
  const totalCurriculumHours = Math.floor(totalCurriculumSeconds / 3600);
  const totalCurriculumMins = Math.floor((totalCurriculumSeconds % 3600) / 60);
  const curriculumDurationLabel =
    totalCurriculumHours > 0
      ? `${totalCurriculumHours}h ${totalCurriculumMins}m`
      : `${totalCurriculumMins}m`;

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
      curriculumDurationLabel={curriculumDurationLabel}
    />
  );
}
