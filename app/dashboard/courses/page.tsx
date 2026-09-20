import Link from "next/link";
import { Plus } from "lucide-react";
import { getServerSession } from "@/lib/auth";
import { listCoursesWithStatsByCreator } from "@/features/courses";
import { Button } from "@/components/ui/button";
import { CourseFilterGrid } from "@/components/course-filter-grid";

function formatRoyalties(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));
}

export default async function CreatorCoursesPage() {
  const session = await getServerSession();
  const userId = session?.user?.id ?? "";

  const { courses, stats } = await listCoursesWithStatsByCreator(userId);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col gap-8 md:gap-10">
      {/* Top Context & Header */}
      <header className="flex flex-col gap-2 pb-6 md:pb-8 border-b border-hairline">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-medium text-slate-gray font-sohne">
            Creator Workspace · Curriculum Ledger
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          <div className="max-w-2xl">
            <h1 className="font-serif text-3xl md:text-[44px] leading-[1.25] tracking-[-0.66px] font-normal text-ink-black">
              Course Management
            </h1>
            <p className="text-[15px] md:text-[17px] leading-[1.5] text-slate-gray mt-1 font-sohne font-normal">
              Draft, publish, and oversee enrollments and monographs across your curriculum.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              render={<Link href="/dashboard/courses/new" />}
              className="rounded-full bg-ink-black text-paper-white px-6 py-2.5 text-[15px] font-medium hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2"
            >
              <Plus className="size-4" />
              <span>New course</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Creator Metrics Ledger Bar */}
      <section
        aria-label="Curriculum ledger summary"
        className="grid grid-cols-2 md:grid-cols-4 bg-paper-white rounded-cards border border-hairline shadow-ledger overflow-hidden p-6 md:p-8 divide-y md:divide-y-0 md:divide-x divide-hairline"
      >
        <div className="flex flex-col gap-1 pr-4 pb-4 md:pb-0">
          <span className="text-[11px] uppercase tracking-widest text-slate-gray font-medium font-sohne">
            Total Students
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-[28px] md:text-[32px] leading-tight font-normal text-ink-black">
              {stats.totalStudents}
            </span>
            <span className="text-xs text-slate-gray font-normal font-sohne">enrolled</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 pl-0 md:pl-8 pr-4 pb-4 md:pb-0">
          <span className="text-[11px] uppercase tracking-widest text-slate-gray font-medium font-sohne">
            Active Masterclasses
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-[28px] md:text-[32px] leading-tight font-normal text-ink-black">
              {stats.publishedCount}
            </span>
            <span className="text-xs text-slate-gray font-normal font-sohne">published</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 pl-0 md:pl-8 pr-4 pt-4 md:pt-0">
          <span className="text-[11px] uppercase tracking-widest text-slate-gray font-medium font-sohne">
            Draft Manuscripts
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-[28px] md:text-[32px] leading-tight font-normal text-ink-black">
              {stats.draftCount}
            </span>
            <span className="text-xs text-slate-gray font-normal font-sohne">in review</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 pl-0 md:pl-8 pt-4 md:pt-0">
          <span className="text-[11px] uppercase tracking-widest text-slate-gray font-medium font-sohne">
            Cumulative Royalties
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-[28px] md:text-[32px] leading-tight font-normal text-ink-black">
              {formatRoyalties(stats.royaltiesCents)}
            </span>
            <span className="text-xs text-slate-gray font-normal font-sohne">earned</span>
          </div>
        </div>
      </section>

      {/* Filterable Curriculum Cards Grid */}
      <CourseFilterGrid courses={courses} />
    </div>
  );
}
