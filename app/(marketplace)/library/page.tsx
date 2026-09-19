import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, BookOpen, Clock, CheckCircle2, Compass } from "lucide-react";
import { getServerSession } from "@/lib/auth";
import { getLearnerLibrary } from "@/features/library";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LibraryInteractiveGrid } from "./library-interactive-grid";

export default async function LibraryPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/library");
  }

  const librarySummary = await getLearnerLibrary(session.user.id);
  const { metrics, isSubscriptionPastDue, courses } = librarySummary;

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-8 md:py-14 flex flex-col gap-8">
      {/* Page Header */}
      <header className="flex flex-col gap-2">
        <span className="font-sohne text-xs uppercase tracking-widest text-ash-gray font-medium">
          Member Workspace
        </span>
        <h1 className="font-serif text-3xl md:text-[44px] text-ink-black font-normal tracking-tight">
          My Library
        </h1>
        <p className="font-sohne text-sm md:text-base text-slate-gray max-w-xl leading-relaxed">
          Your personal space for active course syllabi, continuing instruction, and completed milestone progress.
        </p>
      </header>

      {/* Dunning Notice Banner (Rendered when subscription is past_due) */}
      {isSubscriptionPastDue && (
        <Card className="p-4 md:p-5 bg-amber-500/10 border border-amber-500/30 rounded-cards flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <AlertCircle className="size-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-sohne text-sm font-medium text-amber-900">
                Payment Renewal Issue
              </span>
              <p className="font-sohne text-xs md:text-sm text-amber-800/90 leading-relaxed">
                Your All-Access membership renewal could not be processed, so subscription syllabi are currently paused. All your learning progress is safely preserved. Update your payment method in Billing to restore access instantly.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            render={<Link href="/billing" />}
            className="rounded-full bg-ink-black text-paper-white text-xs font-medium font-sohne hover:opacity-90 px-4 shrink-0 self-start sm:self-auto gap-1"
          >
            <span>Update Billing</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </Card>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-paper-white rounded-smallcards border border-hairline flex items-center gap-3.5">
          <div className="size-9 rounded-full bg-mist-gray flex items-center justify-center text-ink-black shrink-0">
            <BookOpen className="size-4 stroke-[1.8]" />
          </div>
          <div className="flex flex-col">
            <span className="font-sohne text-xs text-slate-gray">Active Syllabi</span>
            <span className="font-serif text-xl font-normal text-ink-black">
              {metrics.activeSyllabiCount}
            </span>
          </div>
        </Card>

        <Card className="p-4 bg-paper-white rounded-smallcards border border-hairline flex items-center gap-3.5">
          <div className="size-9 rounded-full bg-mist-gray flex items-center justify-center text-ink-black shrink-0">
            <Clock className="size-4 stroke-[1.8]" />
          </div>
          <div className="flex flex-col">
            <span className="font-sohne text-xs text-slate-gray">Hours Mastered</span>
            <span className="font-serif text-xl font-normal text-ink-black">
              {metrics.hoursMastered}h
            </span>
          </div>
        </Card>

        <Card className="p-4 bg-paper-white rounded-smallcards border border-hairline flex items-center gap-3.5">
          <div className="size-9 rounded-full bg-mist-gray flex items-center justify-center text-ink-black shrink-0">
            <CheckCircle2 className="size-4 stroke-[1.8]" />
          </div>
          <div className="flex flex-col">
            <span className="font-sohne text-xs text-slate-gray">Completed Syllabi</span>
            <span className="font-serif text-xl font-normal text-ink-black">
              {metrics.completedSyllabiCount}
            </span>
          </div>
        </Card>
      </div>

      {/* Main Course Grid or Empty State */}
      {courses.length > 0 ? (
        <LibraryInteractiveGrid summary={librarySummary} />
      ) : (
        <Card className="py-16 px-6 bg-paper-white rounded-cards border border-hairline text-center flex flex-col items-center justify-center gap-4">
          <div className="size-14 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
            <Compass className="size-7 stroke-[1.5]" />
          </div>
          <div className="flex flex-col gap-1 max-w-md">
            <h2 className="font-serif text-2xl font-normal text-ink-black">
              Your library is waiting
            </h2>
            <p className="font-sohne text-sm text-slate-gray leading-relaxed">
              Enroll in standalone masterclasses or subscribe to the All-Access Pass to unlock every syllabus.
            </p>
          </div>
          <Button
            size="sm"
            render={<Link href="/" />}
            className="rounded-full bg-ink-black text-paper-white text-xs font-medium font-sohne hover:opacity-90 px-5 gap-1.5 mt-2"
          >
            <span>Explore Catalog</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </Card>
      )}
    </div>
  );
}
