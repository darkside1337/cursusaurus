import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Layers,
  Lock,
  PlayCircle,
} from "lucide-react";
import { getServerSession } from "@/lib/auth";
import { getCourseWithLessons } from "@/features/courses";
import { hasAccess } from "@/features/entitlements/access";
import { db } from "@/lib/db";
import { entitlements, subscriptions } from "@/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EnrollmentPanel } from "./enrollment-panel";

interface CourseDetailPageProps {
  params: Promise<{ slug: string }>;
}

function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { slug } = await params;
  const course = await getCourseWithLessons(slug);

  if (!course) {
    notFound();
  }

  const session = await getServerSession();
  const userId = session?.user?.id;

  // Unlisted / draft guard: only the creator can view unpublished drafts
  if (!course.isPublished && course.creatorId !== userId) {
    notFound();
  }

  // Access entitlement check (Invariant #1)
  const isEnrolled = userId ? await hasAccess(userId, course.id) : false;

  const [purchaseEntitlement] = userId
    ? await db
        .select({ id: entitlements.id })
        .from(entitlements)
        .where(
          and(
            eq(entitlements.userId, userId),
            eq(entitlements.courseId, course.id),
            eq(entitlements.source, "purchase"),
            isNull(entitlements.revokedAt)
          )
        )
        .limit(1)
    : [null];
  const isOwned = Boolean(purchaseEntitlement);

  const [activeSub] = userId
    ? await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            or(
              eq(subscriptions.status, "active"),
              eq(subscriptions.status, "trialing")
            )
          )
        )
        .limit(1)
    : [null];
  const hasSubscription = Boolean(activeSub);
  const isComingSoon = course.lessons.length === 0;

  const totalDurationMinutes = Math.round(course.readiness.totalDurationSeconds / 60);
  const durationLabel =
    totalDurationMinutes > 60
      ? `${Math.floor(totalDurationMinutes / 60)}h ${totalDurationMinutes % 60}m`
      : `${totalDurationMinutes}m`;

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-10 flex flex-col gap-8">
      {/* Back Link */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/" />}
          className="text-slate-gray hover:text-ink-black -ml-3 px-3 gap-2 font-normal"
        >
          <ArrowLeft className="size-4" />
          <span>Back to catalog</span>
        </Button>
      </div>

      {/* Main Two-Column Layout (Mobile-first: stacked on mobile, 2-col on lg) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left / Main Content: Monograph Details & Curriculum Syllabus (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Header Info */}
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wider font-medium text-ash-gray font-sohne">
                {course.category} Monograph
              </span>
              <span className="inline-block size-1 rounded-full bg-ash-gray/60" />
              {!course.isPublished ? (
                <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50 text-xs px-2.5 py-0.5 rounded-full">
                  Draft Preview (Creator only)
                </Badge>
              ) : isComingSoon ? (
                <Badge className="bg-mist-gray text-slate-gray text-xs px-2.5 py-0.5 rounded-full">
                  Coming Soon
                </Badge>
              ) : (
                <Badge className="bg-blush-peach text-sienna-brown border-none text-xs px-2.5 py-0.5 rounded-full font-medium">
                  Included in All-Access
                </Badge>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-ink-black font-normal leading-tight tracking-tight">
              {course.title}
            </h1>

            <p className="text-slate-gray font-sohne text-sm sm:text-base">
              Authored by{" "}
              <span className="text-ink-black font-medium">
                {course.creatorName || "Cursusaurus Fellow"}
              </span>
            </p>
          </header>

          {/* Cover Media Container (16:9) */}
          <div className="relative aspect-video w-full rounded-cards overflow-hidden bg-mist-gray border border-hairline shadow-subtle">
            {course.thumbnailUrl ? (
              <Image
                src={course.thumbnailUrl}
                alt={course.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 800px"
              />
            ) : (
              <div className="size-full flex flex-col items-center justify-center gap-2 text-slate-gray">
                <BookOpen className="size-12 stroke-[1.25] text-slate-gray/50" />
                <span className="text-xs font-medium tracking-widest uppercase text-ash-gray font-sohne">
                  Cursusaurus Curriculum
                </span>
              </div>
            )}
          </div>

          {/* Syllabus Monograph Description */}
          {course.description && (
            <section className="flex flex-col gap-2 pt-2 border-t border-hairline">
              <h2 className="font-serif text-xl sm:text-2xl text-ink-black font-normal">
                Syllabus & Course Prospectus
              </h2>
              <p className="text-slate-gray font-sohne text-sm sm:text-base leading-relaxed whitespace-pre-line">
                {course.description}
              </p>
            </section>
          )}

          {/* Ordered Curriculum Syllabus */}
          <section className="flex flex-col gap-4 pt-4 border-t border-hairline">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl sm:text-2xl text-ink-black font-normal">
                Curriculum Structure
              </h2>
              <div className="flex items-center gap-3 text-xs text-ash-gray font-sohne font-medium">
                <span className="flex items-center gap-1">
                  <Layers className="size-3.5" />
                  {course.lessons.length} {course.lessons.length === 1 ? "lesson" : "lessons"}
                </span>
                {course.readiness.totalDurationSeconds > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {durationLabel}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Lesson rows */}
            {course.lessons.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {course.lessons.map((lesson, idx) => {
                  const lessonNumber = (idx + 1).toString().padStart(2, "0");
                  const canWatch = isEnrolled || lesson.isPreview;

                  return (
                    <Card
                      key={lesson.id}
                      className="p-4 bg-paper-white rounded-smallcards border border-hairline flex items-center justify-between gap-4 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-ash-gray font-medium shrink-0">
                          {lessonNumber}
                        </span>

                        <div className="size-8 rounded-lg bg-mist-gray flex items-center justify-center text-slate-gray shrink-0">
                          {canWatch ? (
                            <PlayCircle className="size-4 text-ink-black" />
                          ) : (
                            <Lock className="size-3.5 text-ash-gray" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-ink-black font-sohne truncate">
                            {lesson.title}
                          </span>
                          {lesson.description && (
                            <span className="text-xs text-slate-gray font-sohne line-clamp-1">
                              {lesson.description}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {lesson.isPreview && (
                          <Badge className="bg-mist-gray text-ink-black border border-hairline text-[10px] px-2 py-0 rounded-full font-medium">
                            Free Preview
                          </Badge>
                        )}
                        <span className="text-xs text-ash-gray font-sohne font-medium">
                          {formatDuration(lesson.durationSeconds)}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 bg-fog-white rounded-cards border border-hairline text-center flex flex-col items-center justify-center gap-2">
                <BookOpen className="size-6 text-slate-gray/60" />
                <h3 className="text-sm font-medium text-ink-black font-sohne">
                  Lectures currently being prepared
                </h3>
                <p className="text-xs text-slate-gray max-w-sm">
                  The syllabus and course lectures are currently undergoing curation. Check back soon for enrollment.
                </p>
              </Card>
            )}
          </section>
        </div>

        {/* Right Column: Pricing & Enrollment Panel (4 cols, sticky on lg) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 flex flex-col gap-6">
          <EnrollmentPanel
            course={course}
            isEnrolled={isEnrolled}
            isOwned={isOwned}
            hasSubscription={hasSubscription}
            userId={userId}
          />
        </aside>
      </div>
    </div>
  );
}
