"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, BookOpen, ArrowRight, RotateCcw, Compass } from "lucide-react";
import type { LearnerLibrarySummary, LibraryCourseItem } from "@/features/library";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccessBadge } from "@/components/access-badge";

interface LibraryInteractiveGridProps {
  summary: LearnerLibrarySummary;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ""}`.trim();
  }
  return `${minutes}m`;
}

export function LibraryInteractiveGrid({ summary }: LibraryInteractiveGridProps) {
  const [activeTab, setActiveTab] = React.useState<"all" | "in-progress" | "completed">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const allCourses = summary.courses;
  const inProgressCourses = allCourses.filter(
    (c) => !c.isCompleted && c.completedLessonsCount > 0
  );
  const completedCourses = allCourses.filter((c) => c.isCompleted);

  // Filter by tab
  const tabFiltered = React.useMemo(() => {
    switch (activeTab) {
      case "in-progress":
        return inProgressCourses;
      case "completed":
        return completedCourses;
      case "all":
      default:
        return allCourses;
    }
  }, [activeTab, allCourses, inProgressCourses, completedCourses]);

  // Filter by search query
  const displayedCourses = React.useMemo(() => {
    if (!searchQuery.trim()) return tabFiltered;
    const q = searchQuery.toLowerCase().trim();
    return tabFiltered.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.creatorName && c.creatorName.toLowerCase().includes(q))
    );
  }, [tabFiltered, searchQuery]);

  return (
    <div className="flex flex-col gap-8">
      {/* Controls Bar: Tabs Left, Instant Search Right */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "all" | "in-progress" | "completed")}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
          <TabsList variant="line" className="gap-2 sm:gap-6">
            <TabsTrigger
              value="all"
              className="text-sm font-sohne data-active:text-ink-black data-active:font-medium text-slate-gray"
            >
              All Syllabi ({allCourses.length})
            </TabsTrigger>
            <TabsTrigger
              value="in-progress"
              className="text-sm font-sohne data-active:text-ink-black data-active:font-medium text-slate-gray"
            >
              In Progress ({inProgressCourses.length})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="text-sm font-sohne data-active:text-ink-black data-active:font-medium text-slate-gray"
            >
              Completed ({completedCourses.length})
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-gray pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or topic…"
              className="pl-9 bg-fog-white border-hairline text-ink-black placeholder:text-slate-gray/70 font-sohne text-sm rounded-inputs focus-visible:ring-ink-black/20"
            />
          </div>
        </div>

        {/* Tab Content Display */}
        <TabsContent value={activeTab} className="pt-2">
          {displayedCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedCourses.map((course) => (
                <LibraryCourseCard key={course.id} course={course} />
              ))}

              {/* Always present 'Explore New Syllabi' CTA card */}
              <ExploreMoreCard />
            </div>
          ) : (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-fog-white/60 rounded-cards border border-hairline p-8">
              <BookOpen className="size-8 text-slate-gray/40 stroke-[1.5]" />
              <h2 className="font-sohne text-base font-medium text-ink-black">
                {searchQuery
                  ? "No matching syllabi found"
                  : activeTab === "in-progress"
                  ? "No syllabi currently in progress"
                  : "No completed syllabi yet"}
              </h2>
              <p className="font-sohne text-xs sm:text-sm text-slate-gray max-w-sm">
                {searchQuery
                  ? `No course in your library matches "${searchQuery}". Clear your search to view all syllabi.`
                  : activeTab === "in-progress"
                  ? "Pick any syllabus from your library and start watching to track your milestone progress."
                  : "Completed syllabi and mastery progress will appear here as you finish lessons."}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="rounded-full text-xs font-sohne mt-2"
                >
                  Clear search
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LibraryCourseCard({ course }: { course: LibraryCourseItem }) {
  const remainingSeconds = Math.max(0, course.totalDurationSeconds - course.completedDurationSeconds);

  return (
    <Card className="group relative bg-paper-white rounded-cards p-4 border border-hairline hover:shadow-subtle transition-all flex flex-col justify-between overflow-hidden">
      <div>
        {/* 16:9 Thumbnail Surface */}
        <div className="relative aspect-video w-full overflow-hidden rounded-images bg-fog-white mb-3.5 border border-hairline/60">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-gray/40">
              <BookOpen className="size-8 stroke-[1.5]" />
              <span className="text-[10px] font-medium tracking-widest uppercase text-slate-gray font-sohne">
                {course.category}
              </span>
            </div>
          )}

          {/* Top-Left: Authoritative Access Badge */}
          <div className="absolute top-2.5 left-2.5 z-20">
            <AccessBadge state={course.accessType} />
          </div>

          {/* Top-Right: Finished Badge if Completed */}
          {course.isCompleted && (
            <div className="absolute top-2.5 right-2.5 z-20">
              <Badge variant="outline" className="bg-paper-white/95 text-ink-black border-hairline font-sohne text-[11px] font-medium">
                Finished
              </Badge>
            </div>
          )}

          {/* Bottom-Right: Resume Overlay Indicator */}
          {course.nextLesson && (
            <div className="absolute bottom-2.5 right-2.5 z-20 bg-ink-black/80 backdrop-blur-sm text-paper-white px-2 py-0.5 rounded-full text-[11px] font-sohne font-medium tracking-wide">
              Lesson {course.nextLesson.orderIndex} · {formatDuration(remainingSeconds)} left
            </div>
          )}
        </div>

        {/* Category & Title */}
        <span className="text-[10px] font-medium tracking-widest uppercase text-slate-gray font-sohne block mb-1">
          {course.category}
        </span>
        <h2 className="font-sohne text-base font-medium text-ink-black leading-snug line-clamp-2 mb-1 group-hover:text-slate-gray transition-colors">
          <Link href={course.nextLesson ? `/learn/${course.slug}/${course.nextLesson.slug}` : `/${course.slug}`}>
            {course.title}
          </Link>
        </h2>
        <p className="text-slate-gray text-xs font-sohne line-clamp-1 mb-4">
          {course.creatorName ?? "Cursusaurus Fellow"}
        </p>
      </div>

      {/* Progress & Actions Strip (NO PRICING CHROME!) */}
      <div className="mt-2 pt-3 border-t border-hairline/80 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-sohne text-slate-gray">
            <span>{course.progressPercentage}% completed</span>
            <span>
              {course.completedLessonsCount}/{course.lessonCount} lessons
            </span>
          </div>
          <Progress
            value={course.progressPercentage}
            className="h-1.5"
            aria-label={`${course.title} completion progress`}
          />
        </div>

        {/* Action Button */}
        {course.isCompleted ? (
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={course.nextLesson ? `/learn/${course.slug}/${course.nextLesson.slug}` : `/${course.slug}`} />
            }
            className="w-full rounded-full border-hairline text-ink-black hover:bg-mist-gray text-xs font-medium font-sohne gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Rewatch Syllabus</span>
          </Button>
        ) : (
          <Button
            size="sm"
            render={
              <Link href={course.nextLesson ? `/learn/${course.slug}/${course.nextLesson.slug}` : `/${course.slug}`} />
            }
            className="w-full rounded-full bg-ink-black text-paper-white hover:opacity-90 text-xs font-medium font-sohne gap-1.5"
          >
            <span>Resume Lesson {course.nextLesson?.orderIndex ?? 1}</span>
            <ArrowRight className="size-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function ExploreMoreCard() {
  return (
    <Card className="rounded-cards p-6 border-2 border-dashed border-hairline bg-paper-white/50 hover:bg-paper-white hover:border-slate-gray/40 transition-all flex flex-col justify-between items-center text-center group min-h-[340px]">
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="size-12 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray group-hover:text-ink-black group-hover:scale-110 transition-all">
          <Compass className="size-6 stroke-[1.5]" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="font-sohne text-base font-medium text-ink-black">
            Explore New Syllabi
          </h2>
          <p className="font-sohne text-xs text-slate-gray max-w-[220px]">
            Expand your editorial craftsmanship with newly published masterclasses.
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        render={<Link href="/" />}
        className="w-full rounded-full border-hairline text-ink-black text-xs font-medium font-sohne hover:bg-mist-gray gap-1.5"
      >
        <span>Browse Catalog</span>
        <ArrowRight className="size-3.5" />
      </Button>
    </Card>
  );
}
