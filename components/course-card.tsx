import Link from "next/link";
import Image from "next/image";
import { BookOpen, Clock, Layers } from "lucide-react";
import type { CatalogCourseItem } from "@/features/courses";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface CourseCardProps {
  course: CatalogCourseItem;
  accessState?: "all-access" | "purchased" | "none";
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ""}`.trim();
  }
  return `${minutes}m`;
}

export function CourseCard({ course, accessState = "none" }: CourseCardProps) {
  const formattedPrice = `$${Math.round(course.priceCents / 100)}`;
  const durationStr = formatDuration(course.totalDurationSeconds);
  const isComingSoon = course.lessonCount === 0;

  return (
    <Card className="group relative bg-paper-white rounded-cards p-4 border border-hairline hover:shadow-subtle hover:-translate-y-0.5 transition-all flex flex-col justify-between overflow-hidden">
      <div>
        {/* 16:9 Aspect Video Thumbnail Container */}
        <Link
          href={`/${course.slug}`}
          className="relative aspect-video w-full rounded-images overflow-hidden bg-mist-gray border border-hairline/60 mb-3.5 block group-hover:border-slate-gray/30 transition-colors"
          tabIndex={-1}
          aria-hidden="true"
        >
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="size-full flex flex-col items-center justify-center gap-1.5 text-slate-gray">
              <BookOpen className="size-7 stroke-[1.5] text-slate-gray/60" />
              <span className="text-[10px] font-medium tracking-widest uppercase text-ash-gray font-sohne">
                {course.category} Monograph
              </span>
            </div>
          )}

          {/* Access Signal Badge Top-Left (strictly access-state signaling per docs/DESIGN.md) */}
          {accessState === "purchased" ? (
            <div className="absolute top-2.5 left-2.5 z-20">
              <Badge className="bg-mist-gray text-ink-black border border-hairline/80 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide shadow-none">
                Purchased
              </Badge>
            </div>
          ) : accessState === "all-access" ? (
            <div className="absolute top-2.5 left-2.5 z-20">
              <Badge className="bg-blush-peach text-sienna-brown px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide shadow-none border-none">
                All-Access
              </Badge>
            </div>
          ) : isComingSoon ? (
            <div className="absolute top-2.5 left-2.5 z-20">
              <Badge className="bg-mist-gray/90 text-slate-gray px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide shadow-none border border-hairline">
                Coming Soon
              </Badge>
            </div>
          ) : null}
        </Link>

        {/* Category kicker */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] tracking-wider uppercase text-ash-gray font-medium font-sohne">
            {course.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-sohne text-body-lg font-medium text-ink-black leading-snug line-clamp-2 mb-1">
          <Link href={`/${course.slug}`} className="hover:text-slate-gray transition-colors">
            {course.title}
          </Link>
        </h3>

        {/* Creator Name */}
        <p className="text-slate-gray text-caption font-sohne line-clamp-1 mb-4">
          {course.creatorName ? `by ${course.creatorName}` : "Cursusaurus Fellow"}
        </p>
      </div>

      {/* Footer Details & Pricing/Status */}
      <div className="pt-3 border-t border-hairline flex items-center justify-between text-xs">
        {/* Lesson count & duration */}
        <div className="flex items-center gap-2 text-ash-gray font-medium font-sohne">
          <span className="flex items-center gap-1">
            <Layers className="size-3" />
            {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
          </span>
          {durationStr && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {durationStr}
              </span>
            </>
          )}
        </div>

        {/* Access state or standalone price */}
        <div>
          {accessState === "purchased" ? (
            <span className="text-ink-black font-medium font-sohne">Enrolled</span>
          ) : accessState === "all-access" ? (
            <span className="text-sienna-brown font-medium font-sohne">Included with Pass</span>
          ) : isComingSoon ? (
            <span className="text-slate-gray font-medium font-sohne">Coming soon</span>
          ) : (
            <span className="text-ink-black font-medium font-sohne text-sm">
              {formattedPrice}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
