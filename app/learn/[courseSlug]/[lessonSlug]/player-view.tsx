"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Lock,
  PlayCircle,
  Clock,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { VideoPlayerShell } from "@/components/video-player-shell";
import { ClassroomHeader } from "@/components/classroom/classroom-header";
import { toggleLessonCompletionAction } from "@/features/progress/actions";
import type { CourseProgressSummary } from "@/features/progress/types";
import { toast } from "sonner";

interface LessonMeta {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationSeconds: number | null;
  orderIndex: number;
  isPreview: boolean;
}

interface PlayerViewProps {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
  };
  currentLesson: LessonMeta;
  allLessons: LessonMeta[];
  isUnlocked: boolean;
  isCourseEnrolled: boolean;
  initialProgress: CourseProgressSummary;
  previousLesson: { title: string; slug: string } | null;
  nextLesson: { title: string; slug: string } | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PlayerView({
  course,
  currentLesson,
  allLessons,
  isUnlocked,
  isCourseEnrolled,
  initialProgress,
  previousLesson,
  nextLesson,
}: PlayerViewProps) {
  const [progressSummary, setProgressSummary] = useState(initialProgress);
  const [isPending, startTransition] = useTransition();

  const currentLessonProgress = progressSummary.lessons[currentLesson.id];
  const isCurrentCompleted = Boolean(currentLessonProgress?.completed);
  const initialPosition = currentLessonProgress?.lastPositionSeconds ?? 0;

  const currentIdx = allLessons.findIndex((l) => l.id === currentLesson.id);
  const formattedIndex = (currentIdx + 1).toString().padStart(2, "0");

  const totalCurriculumSeconds = allLessons.reduce(
    (acc, l) => acc + (l.durationSeconds ?? 0),
    0
  );
  const totalCurriculumHours = Math.floor(totalCurriculumSeconds / 3600);
  const totalCurriculumMins = Math.floor((totalCurriculumSeconds % 3600) / 60);
  const curriculumDurationLabel =
    totalCurriculumHours > 0
      ? `${totalCurriculumHours}h ${totalCurriculumMins}m`
      : `${totalCurriculumMins}m`;

  const handleVideoCompleted = () => {
    setProgressSummary((prev) => {
      const existing = prev.lessons[currentLesson.id];
      if (existing?.completed) return prev;

      const nextLessons = {
        ...prev.lessons,
        [currentLesson.id]: {
          ...(existing || {
            id: "",
            userId: "",
            courseId: course.id,
            lessonId: currentLesson.id,
            lastPositionSeconds: currentLesson.durationSeconds ?? 0,
            updatedAt: new Date(),
          }),
          completed: true,
        },
      };

      const completedCount = Object.values(nextLessons).filter((l) => l.completed).length;
      const pct =
        prev.totalLessonsCount > 0
          ? Math.round((completedCount / prev.totalLessonsCount) * 100)
          : 0;

      return {
        ...prev,
        completedLessonsCount: completedCount,
        percentage: pct,
        lessons: nextLessons,
      };
    });
  };

  const handleToggleComplete = () => {
    const nextCompleted = !isCurrentCompleted;

    // Optimistic state update
    setProgressSummary((prev) => {
      const existing = prev.lessons[currentLesson.id];
      const nextLessons = {
        ...prev.lessons,
        [currentLesson.id]: {
          ...(existing || {
            id: "",
            userId: "",
            courseId: course.id,
            lessonId: currentLesson.id,
            lastPositionSeconds: 0,
            updatedAt: new Date(),
          }),
          completed: nextCompleted,
        },
      };

      const completedCount = Object.values(nextLessons).filter((l) => l.completed).length;
      const pct =
        prev.totalLessonsCount > 0
          ? Math.round((completedCount / prev.totalLessonsCount) * 100)
          : 0;

      return {
        ...prev,
        completedLessonsCount: completedCount,
        percentage: pct,
        lessons: nextLessons,
      };
    });

    startTransition(async () => {
      const res = await toggleLessonCompletionAction({
        courseId: course.id,
        lessonId: currentLesson.id,
        completed: nextCompleted,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update completion");
        setProgressSummary(initialProgress);
      }
    });
  };

  return (
    <div className="min-h-screen bg-fog-white flex flex-col">
      {/* Top Editorial Classroom Header */}
      <ClassroomHeader
        courseTitle={course.title}
        courseSlug={course.slug}
        completedLessons={progressSummary.completedLessonsCount}
        totalLessons={progressSummary.totalLessonsCount}
      />

      {/* Main Classroom Layout (Mobile-first stacked, 12-col on lg) */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Video Hero & Monograph Synopsis (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* 1. Video Player Shell */}
            <VideoPlayerShell
              courseId={course.id}
              lessonId={currentLesson.id}
              courseSlug={course.slug}
              isUnlocked={isUnlocked}
              isPreview={currentLesson.isPreview}
              initialPositionSeconds={initialPosition}
              isCompleted={isCurrentCompleted}
              onCompleted={handleVideoCompleted}
            />

            {/* 2. Lesson Title & Author Row */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-mono text-ash-gray font-medium">
                <span>Lecture {formattedIndex}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-sohne">
                  <Clock className="size-3" />
                  {formatDuration(currentLesson.durationSeconds)}
                </span>
                {currentLesson.isPreview && (
                  <>
                    <span>•</span>
                    <Badge className="bg-mist-gray text-ink-black border border-hairline text-[10px] px-2 py-0 rounded-full font-medium">
                      Free Preview
                    </Badge>
                  </>
                )}
              </div>

              <h1 className="font-serif text-2xl sm:text-3xl text-ink-black font-normal leading-tight">
                {currentLesson.title}
              </h1>
            </div>

            {/* 3. Action Bar (Directly beneath video & title — no fold severance) */}
            <div className="flex items-center justify-between gap-3 border-y border-hairline py-3">
              <div>
                {previousLesson ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/learn/${course.slug}/${previousLesson.slug}`} />}
                    className="rounded-full border-hairline text-slate-gray hover:text-ink-black text-xs font-sohne gap-1.5"
                  >
                    <ChevronLeft className="size-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="rounded-full border-hairline text-ash-gray/50 text-xs font-sohne gap-1.5"
                  >
                    <ChevronLeft className="size-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                )}
              </div>

              {/* Completion Toggle (only visible when user has access) */}
              {isUnlocked && (
                <Button
                  onClick={handleToggleComplete}
                  disabled={isPending}
                  variant={isCurrentCompleted ? "outline" : "default"}
                  size="sm"
                  className={
                    isCurrentCompleted
                      ? "rounded-full border-hairline text-ink-black hover:bg-mist-gray text-xs font-sohne gap-1.5"
                      : "rounded-full bg-ink-black text-paper-white hover:bg-ink-black/90 text-xs font-sohne gap-1.5 shadow-sm"
                  }
                >
                  {isCurrentCompleted ? (
                    <>
                      <Check className="size-3.5 text-emerald-600 stroke-[2.5]" />
                      <span>Completed</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      <span>Mark as Complete</span>
                    </>
                  )}
                </Button>
              )}

              <div>
                {nextLesson ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/learn/${course.slug}/${nextLesson.slug}`} />}
                    className="rounded-full border-hairline text-slate-gray hover:text-ink-black text-xs font-sohne gap-1.5"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="rounded-full border-hairline text-ash-gray/50 text-xs font-sohne gap-1.5"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* 4. Lesson Monograph Synopsis & Learning Notes */}
            <div className="flex flex-col gap-3 pt-2">
              <h2 className="font-serif text-lg text-ink-black font-normal">
                Lecture Synopsis & Notes
              </h2>
              {currentLesson.description ? (
                <div className="font-sohne text-sm text-slate-gray leading-relaxed whitespace-pre-line">
                  {currentLesson.description}
                </div>
              ) : (
                <p className="font-sohne text-xs text-ash-gray italic">
                  No lecture notes attached to this lesson.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Sticky Curriculum Syllabus (4 cols) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-20 flex flex-col gap-4">
            <Card className="rounded-[20px] bg-paper-white border border-hairline p-5 shadow-sm">
              <div className="border-b border-hairline pb-4 mb-4">
                <h3 className="font-serif text-lg text-ink-black font-normal">
                  Curriculum Outline
                </h3>
                <p className="font-sohne text-xs text-slate-gray mt-0.5">
                  {allLessons.length} {allLessons.length === 1 ? "lecture" : "lectures"} · {curriculumDurationLabel} instruction
                </p>
              </div>

              {/* Lesson Items */}
              <div className="flex flex-col gap-1.5" role="list">
                {allLessons.map((lesson, idx) => {
                  const lessonNum = (idx + 1).toString().padStart(2, "0");
                  const isCurrent = lesson.id === currentLesson.id;
                  const prog = progressSummary.lessons[lesson.id];
                  const isDone = Boolean(prog?.completed);
                  const isAccessible = isCourseEnrolled || lesson.isPreview;

                  return (
                    <Link
                      key={lesson.id}
                      href={`/learn/${course.slug}/${lesson.slug}`}
                      className={`group flex items-center justify-between gap-3 p-2.5 rounded-inputs transition-colors ${
                        isCurrent
                          ? "bg-mist-gray text-ink-black font-medium"
                          : "hover:bg-mist-gray/50 text-slate-gray hover:text-ink-black"
                      }`}
                      role="listitem"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Status Icon / Index */}
                        <div className="size-6 rounded-md flex items-center justify-center shrink-0">
                          {isDone ? (
                            <CheckCircle2 className="size-4 text-emerald-600 stroke-[2]" />
                          ) : !isAccessible ? (
                            <Lock className="size-3.5 text-sienna-brown stroke-[2]" />
                          ) : isCurrent ? (
                            <PlayCircle className="size-4 text-ink-black stroke-[2]" />
                          ) : (
                            <span className="font-mono text-xs text-ash-gray font-medium">
                              {lessonNum}
                            </span>
                          )}
                        </div>

                        <span className="font-sohne text-xs truncate">
                          {lesson.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {lesson.isPreview && (
                          <Badge className="bg-mist-gray text-ink-black border border-hairline text-[9px] px-1.5 py-0 rounded-full font-medium">
                            Preview
                          </Badge>
                        )}
                        {!isAccessible && (
                          <Badge
                            variant="secondary"
                            className="bg-blush-peach text-sienna-brown border border-blush-peach text-[9px] px-1.5 py-0 rounded-full font-medium"
                          >
                            All-Access
                          </Badge>
                        )}
                        <span className="font-sohne text-[11px] text-ash-gray">
                          {formatDuration(lesson.durationSeconds)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
