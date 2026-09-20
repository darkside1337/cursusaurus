"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface ClassroomHeaderProps {
  courseTitle: string;
  courseSlug: string;
  completedLessons: number;
  totalLessons: number;
}

export function ClassroomHeader({
  courseTitle,
  courseSlug,
  completedLessons,
  totalLessons,
}: ClassroomHeaderProps) {
  const progressPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <header className="border-b border-hairline bg-paper-white/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Editorial Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-gray truncate min-w-0 mr-4">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/${courseSlug}`} />}
            className="rounded-full px-2 text-slate-gray hover:text-ink-black font-sohne text-xs shrink-0"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            <span>Back to course</span>
          </Button>
          <span className="text-slate-gray/40">/</span>
          <span className="font-sohne font-medium text-ink-black truncate">
            {courseTitle}
          </span>
        </div>

        {/* Course Progress */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-gray font-sohne hidden sm:inline">
            {progressPercent}% completed ({completedLessons}/{totalLessons})
          </span>
          <div className="w-24 sm:w-32">
            <Progress
              value={progressPercent}
              className="h-1 w-full bg-mist-gray rounded-full"
              aria-label={`${courseTitle} completion progress`}
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
