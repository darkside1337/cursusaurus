"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Plus, BookOpen, MoreVertical } from "lucide-react";
import type { CreatorCourseItem } from "@/features/courses";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CourseFilterGridProps {
  courses: CreatorCourseItem[];
}

export function CourseFilterGrid({ courses }: CourseFilterGridProps) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // Tab status filter
      if (activeTab === "published" && !course.isPublished) return false;
      if (activeTab === "draft" && course.isPublished) return false;

      // Text search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = course.title.toLowerCase().includes(query);
        const descMatch = course.description?.toLowerCase().includes(query) ?? false;
        const slugMatch = course.slug.toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !slugMatch) return false;
      }

      return true;
    });
  }, [courses, activeTab, searchQuery]);

  const publishedCount = useMemo(
    () => courses.filter((c) => c.isPublished).length,
    [courses]
  );
  const draftCount = useMemo(
    () => courses.filter((c) => !c.isPublished).length,
    [courses]
  );

  const formatRelativeTime = (date: Date) => {
    const elapsedMs = new Date().getTime() - new Date(date).getTime();
    const minutes = Math.round(elapsedMs / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
    const years = Math.round(months / 12);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Controls: Filter Tabs & Search */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList variant="line" className="overflow-x-auto">
            <TabsTrigger value="all" className="whitespace-nowrap">
              All Courses <span className="text-slate-gray font-normal ml-1">({courses.length})</span>
            </TabsTrigger>
            <TabsTrigger value="published" className="whitespace-nowrap">
              Published <span className="text-ash-gray font-normal ml-1">({publishedCount})</span>
            </TabsTrigger>
            <TabsTrigger value="draft" className="whitespace-nowrap">
              Drafts <span className="text-ash-gray font-normal ml-1">({draftCount})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-gray pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter curriculum..."
            className="pl-10 h-10 rounded-[16px] bg-paper-white border border-hairline focus-visible:border-ink-black focus-visible:ring-1 focus-visible:ring-ink-black/20 text-sm shadow-none"
          />
        </div>
      </section>

      {/* Course Cards Grid or Empty States */}
      {filteredCourses.length > 0 ? (
        <section
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          aria-label="Creator courses grid"
        >
          {filteredCourses.map((course) => (
            <Card
              key={course.id}
              className="flex flex-col justify-between bg-paper-white rounded-cards border border-hairline p-5 hover:shadow-subtle transition-all duration-200"
            >
              <div>
                {/* Thumbnail container */}
                <div className="relative aspect-video w-full rounded-[12px] overflow-hidden mb-4 bg-mist-gray border border-hairline/60">
                  {course.thumbnailUrl ? (
                    <Image
                      src={course.thumbnailUrl}
                      alt={course.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="size-full flex flex-col items-center justify-center gap-1.5 text-slate-gray">
                      <BookOpen className="size-8 stroke-[1.5] text-slate-gray/60" />
                      <span className="text-[11px] font-medium tracking-wider uppercase text-ash-gray font-sohne">
                        Monograph
                      </span>
                    </div>
                  )}

                  {/* Access signal badge (peach used only for access state per DESIGN.md) */}
                  {course.isPublished && course.lessonCount >= 1 && (
                    <Badge className="absolute top-3 left-3 bg-blush-peach text-sienna-brown px-3 py-1 rounded-full text-[11px] font-medium tracking-wide shadow-none border-none">
                      All-Access
                    </Badge>
                  )}
                </div>

                {/* Category kicker */}
                <span className="block text-[11px] tracking-wider text-ash-gray uppercase font-medium mb-1.5 font-sohne">
                  {course.category ?? "Curriculum Monograph"}
                </span>

                <h2 className="text-[18px] md:text-[20px] font-medium text-ink-black leading-snug line-clamp-2 mb-2 font-sohne">
                  <Link
                    href={`/dashboard/courses/${course.id}`}
                    className="hover:text-slate-gray transition-colors"
                  >
                    {course.title}
                  </Link>
                </h2>

                <p className="text-xs text-slate-gray font-normal font-sohne">
                  Last edited {formatRelativeTime(course.updatedAt)}
                </p>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-6 pt-4 border-t border-hairline flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Badge
                    variant={course.isPublished ? "secondary" : "outline"}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      course.isPublished
                        ? "bg-mist-gray text-ink-black"
                        : "border border-dashed border-ash-gray/60 text-ash-gray"
                    }`}
                  >
                    {course.isPublished ? "Published" : "Draft"}
                  </Badge>
                  <span className="text-xs text-slate-gray font-sohne">
                    {course.salesCount} {course.salesCount === 1 ? "sale" : "sales"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/dashboard/courses/${course.id}`} />}
                    className="rounded-full border-ink-black/20 hover:border-ink-black text-ink-black px-4 py-1.5 text-sm font-medium transition-colors"
                  >
                    Edit
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="More actions"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-gray hover:text-ink-black hover:bg-mist-gray transition-colors"
                    >
                      <MoreVertical className="size-[18px]" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-paper-white border border-hairline rounded-images shadow-subtle p-1 w-44">
                      <DropdownMenuItem
                        render={<Link href={`/dashboard/courses/${course.id}`} />}
                        className="text-sm text-ink-black focus:bg-mist-gray focus:text-ink-black rounded-md px-2 py-1.5"
                      >
                        Edit course
                      </DropdownMenuItem>
                      {course.isPublished && (
                        <DropdownMenuItem
                          render={<Link href={`/${course.slug}`} />}
                          className="text-sm text-ink-black focus:bg-mist-gray focus:text-ink-black rounded-md px-2 py-1.5"
                        >
                          Public preview
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : (
        /* Empty State */
        <Card className="bg-paper-white rounded-cards border border-hairline p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="size-14 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
            <BookOpen className="size-6 stroke-[1.5]" />
          </div>

          <div className="max-w-md">
            <h3 className="text-lg font-medium text-ink-black font-serif">
              {searchQuery.trim()
                ? "No curriculum matches your filter"
                : activeTab !== "all"
                ? `No ${activeTab} courses found`
                : "No courses authored yet"}
            </h3>
            <p className="text-sm text-slate-gray mt-1 font-sohne">
              {searchQuery.trim()
                ? `No courses match "${searchQuery}". Try adjusting your search query or status filter.`
                : "Begin formulating your first monograph for Cursusaurus learners."}
            </p>
          </div>

          {!searchQuery.trim() && (
            <Button
              render={<Link href="/dashboard/courses/new" />}
              className="mt-2 rounded-full bg-ink-black text-paper-white px-6 text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Plus className="size-4" />
              <span>Create course</span>
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
