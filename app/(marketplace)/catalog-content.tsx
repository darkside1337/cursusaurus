"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, BookOpen, Sparkles } from "lucide-react";
import type { CatalogCourseItem } from "@/features/courses";
import { CourseCard } from "@/components/course-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const CATALOG_CATEGORIES = [
  "All",
  "Design",
  "Code",
  "Marketing",
  "Writing",
  "Business",
  "Photography",
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export function filterCatalogCourses(
  courses: CatalogCourseItem[],
  activeCategory: string,
  searchQuery: string
): CatalogCourseItem[] {
  return courses.filter((course) => {
    // Category filter
    if (activeCategory !== "All" && course.category !== activeCategory) {
      return false;
    }

    // Text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const matchTitle = course.title.toLowerCase().includes(query);
      const matchDesc = course.description?.toLowerCase().includes(query) ?? false;
      const matchCreator = course.creatorName?.toLowerCase().includes(query) ?? false;
      const matchCategory = course.category?.toLowerCase().includes(query) ?? false;

      if (!matchTitle && !matchDesc && !matchCreator && !matchCategory) {
        return false;
      }
    }

    return true;
  });
}

export function CatalogGridSkeleton() {
  return (
    <div
      data-slot="catalog-skeleton-grid"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
      aria-label="Loading course catalog..."
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Card
          key={i}
          className="p-4 bg-paper-white rounded-cards border border-hairline flex flex-col justify-between overflow-hidden"
        >
          <div>
            <Skeleton className="aspect-video w-full rounded-images mb-3.5" />
            <Skeleton className="h-3 w-16 mb-2 rounded-full" />
            <Skeleton className="h-6 w-5/6 mb-2 rounded-md" />
            <Skeleton className="h-4 w-1/3 mb-4 rounded-md" />
          </div>
          <div className="pt-3 border-t border-hairline flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-12 rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  );
}

interface CatalogContentProps {
  courses: CatalogCourseItem[];
  userAccessMap?: Record<string, "all-access" | "purchased" | "none">;
  hasAllAccessSubscription?: boolean;
  isLoading?: boolean;
}

export function CatalogContent({
  courses,
  userAccessMap = {},
  hasAllAccessSubscription = false,
  isLoading = false,
}: CatalogContentProps) {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredCourses = useMemo(
    () => filterCatalogCourses(courses, activeCategory, searchQuery),
    [courses, activeCategory, searchQuery]
  );

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-8 md:py-14 flex flex-col gap-10 md:gap-14">
      {/* Hero Section */}
      <section className="flex flex-col items-start gap-4 max-w-3xl">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest font-medium text-ash-gray font-sohne">
            Curated Curriculum · Edition 2026
          </span>
          <span className="inline-block size-1 rounded-full bg-ash-gray/60" />
          <Badge className="bg-mist-gray text-ink-black border-none text-[11px] font-medium px-2 py-0.5 rounded-full">
            {courses.length} masterclasses
          </Badge>
        </div>

        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-ink-black tracking-tight font-normal leading-[1.15]">
          Learn something new
        </h1>

        <p className="text-slate-gray font-sohne text-base sm:text-lg leading-relaxed max-w-2xl">
          Depth-first masterclasses, workshops, and monographs taught by practicing leaders. Master the principles that endure.
        </p>
      </section>

      {/* Search & Category Filter Section */}
      <section className="flex flex-col gap-4 border-b border-hairline pb-8" aria-label="Catalog filters">
        {/* Search Input */}
        <div className="relative w-full max-w-xl">
          <Search className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-gray pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic, instructor, or monograph title..."
            className="pl-11 pr-10 h-12 rounded-inputs bg-paper-white border border-hairline focus-visible:border-ink-black focus-visible:ring-1 focus-visible:ring-ink-black/20 text-sm shadow-none"
            aria-label="Search courses"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-7 text-slate-gray hover:text-ink-black"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* Category Pills (horizontally scrolling on mobile per docs/DESIGN.md) */}
        <div
          className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap md:flex-wrap"
          role="tablist"
          aria-label="Course categories"
        >
          {CATALOG_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat;
            return (
              <Button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isSelected}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-2 text-xs font-medium shrink-0 transition-colors ${
                  isSelected
                    ? "bg-ink-black text-paper-white hover:opacity-90"
                    : "border-hairline text-slate-gray hover:text-ink-black hover:border-slate-gray/40 bg-paper-white"
                }`}
              >
                {cat}
              </Button>
            );
          })}
        </div>
      </section>

      {/* All-Access Promo Banner (Blush Peach surface, Sienna Brown text) */}
      {!hasAllAccessSubscription && (
        <section
          aria-label="All-Access subscription overview"
          className="bg-blush-peach rounded-cards p-6 sm:p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-sienna-brown/10 shadow-subtle"
        >
          <div className="flex flex-col gap-2 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-sienna-brown" />
              <span className="text-xs uppercase tracking-wider text-sienna-brown font-semibold font-sohne">
                All-Access Membership
              </span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl text-sienna-brown font-normal leading-snug">
              Unlimited access to every course in the catalog
            </h2>
            <p className="text-sienna-brown/90 text-sm sm:text-[15px] font-sohne leading-relaxed">
              $15/mo billed annually. Unlock every current masterclass, lecture materials, and all upcoming releases under one simple pass.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              render={<Link href="/pricing" />}
              className="rounded-full bg-sienna-brown hover:bg-ink-black text-paper-white px-7 py-3 text-sm font-medium transition-colors shadow-sm"
            >
              Start 7-day free trial
            </Button>
          </div>
        </section>
      )}

      {/* Course Grid / Empty States */}
      <section aria-label="Course catalog grid">
        {isLoading ? (
          <CatalogGridSkeleton />
        ) : filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredCourses.map((course) => {
              const access =
                userAccessMap[course.id] ||
                (hasAllAccessSubscription ? "all-access" : "none");

              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  accessState={access}
                />
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <Card className="bg-paper-white rounded-cards border border-hairline p-12 md:p-16 text-center flex flex-col items-center justify-center gap-4">
            <div className="size-14 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
              <BookOpen className="size-6 stroke-[1.5]" />
            </div>

            <div className="max-w-md">
              <h3 className="text-lg font-medium text-ink-black font-serif">
                {searchQuery.trim()
                  ? `No masterclasses found matching "${searchQuery}"`
                  : `No courses in ${activeCategory} category`}
              </h3>
              <p className="text-sm text-slate-gray mt-1.5 font-sohne leading-relaxed">
                {searchQuery.trim()
                  ? "Try checking for spelling errors or clearing your search term to view all curriculum."
                  : "We are currently preparing monographs in this subject. Check back soon or browse other fields."}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("All");
              }}
              className="mt-2 rounded-full border-hairline text-ink-black text-xs font-medium px-5"
            >
              Clear filters and view all
            </Button>
          </Card>
        )}
      </section>
    </div>
  );
}
