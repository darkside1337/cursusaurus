"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPriceCents } from "@/lib/format-price";
import { createCourseCheckoutSessionAction } from "@/features/purchases/actions";
import { createSubscriptionCheckoutSessionAction } from "@/features/subscriptions/actions";
import type { CourseReadiness } from "@/features/courses/types";

interface EnrollmentPanelProps {
  course: {
    id: string;
    title: string;
    slug: string;
    priceCents: number;
    readiness: CourseReadiness;
  };
  isEnrolled: boolean;
  isOwned: boolean;
  hasSubscription: boolean;
  userId?: string | null;
}

export function EnrollmentPanel({
  course,
  isEnrolled,
  isOwned,
  hasSubscription,
  userId,
}: EnrollmentPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isComingSoon = !course.readiness.isPurchaseEligible;

  function handleBuyCourse() {
    if (!userId) {
      router.push(`/login?callbackUrl=/${course.slug}`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await createCourseCheckoutSessionAction(course.id);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.loginUrl) {
          router.push(res.loginUrl);
          return;
        }
        if (res.url) {
          window.location.href = res.url;
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to start checkout");
      }
    });
  }

  function handleSubscribe() {
    if (!userId) {
      router.push(`/login?callbackUrl=/${course.slug}`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await createSubscriptionCheckoutSessionAction(`/${course.slug}`);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.redirectTo) {
          router.push(res.redirectTo);
          return;
        }
        if (res.loginUrl) {
          router.push(res.loginUrl);
          return;
        }
        if (res.url) {
          window.location.href = res.url;
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to start All-Access checkout");
      }
    });
  }

  return (
    <Card className="p-6 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col gap-6">
      {/* Header / Price Display */}
      <div className="flex flex-col gap-1 border-b border-hairline pb-4">
        <span className="font-sohne text-xs uppercase tracking-wider text-slate-gray font-medium">
          Acquisition & Access
        </span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-serif text-3xl sm:text-4xl text-ink-black font-normal">
            {formatPriceCents(course.priceCents)}
          </span>
          <span className="font-sohne text-xs text-slate-gray">one-time acquisition</span>
        </div>
      </div>

      {/* State 1: User owns course outright */}
      {isOwned ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 bg-blush-peach/30 border border-sienna-brown/20 p-3.5 rounded-inputs text-xs font-sohne text-sienna-brown">
            <CheckCircle2 className="size-4 shrink-0 text-sienna-brown" />
            <span className="font-medium">You own this course monograph in perpetuity</span>
          </div>
          <Button
            render={<Link href="/library" />}
            className="w-full rounded-full bg-ink-black text-paper-white py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to My Library
          </Button>
        </div>
      ) : isEnrolled ? (
        /* State 2: Enrolled via All-Access Pass, but does not own outright */
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 bg-blush-peach/40 border border-sienna-brown/20 p-3.5 rounded-inputs text-xs font-sohne text-sienna-brown">
            <Sparkles className="size-4 shrink-0 text-sienna-brown" />
            <span className="font-medium">Included with your All-Access Pass</span>
          </div>

          <Button
            render={<Link href="/library" />}
            className="w-full rounded-full bg-ink-black text-paper-white py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to My Library
          </Button>

          {/* Overlap Flow: Subscriber can still purchase course outright */}
          <div className="pt-2 border-t border-hairline flex flex-col gap-1.5 text-center">
            <Button
              variant="outline"
              onClick={handleBuyCourse}
              disabled={isPending}
              className="w-full rounded-full text-xs font-medium border-hairline text-ink-black hover:bg-mist-gray py-2.5"
            >
              {isPending ? "Connecting..." : `Own it forever — ${formatPriceCents(course.priceCents)}`}
            </Button>
            <p className="font-sohne text-[11px] text-slate-gray leading-snug">
              Retain permanent lifetime ownership even if you cancel All-Access
            </p>
          </div>
        </div>
      ) : isComingSoon ? (
        /* State 3: Course not purchase-eligible yet */
        <div className="flex flex-col gap-3">
          <div className="bg-mist-gray p-3.5 rounded-inputs text-xs text-slate-gray font-sohne leading-relaxed">
            This monograph is currently undergoing editorial preparation. Once the syllabus lectures are published, enrollment will open immediately.
          </div>
          <Button
            disabled
            className="w-full rounded-full bg-mist-gray text-slate-gray py-3 text-sm font-medium cursor-not-allowed border-none"
          >
            Coming Soon
          </Button>
        </div>
      ) : (
        /* State 4: Unenrolled, eligible for purchase & subscription */
        <div className="flex flex-col gap-4">
          {/* One-time purchase */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleBuyCourse}
              disabled={isPending}
              className="w-full rounded-full bg-ink-black text-paper-white py-3 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              {isPending ? "Connecting to checkout..." : `Buy course — ${formatPriceCents(course.priceCents)}`}
            </Button>
            <p className="text-[11px] text-slate-gray text-center font-sohne">
              Perpetual ownership · Includes all future updates
            </p>
          </div>

          {/* All-Access Pass option */}
          {!hasSubscription && (
            <div className="bg-blush-peach rounded-inputs p-4 flex flex-col gap-2.5 border border-sienna-brown/10">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-sienna-brown" />
                <span className="font-sohne text-xs font-semibold text-sienna-brown uppercase tracking-wider">
                  All-Access Pass
                </span>
              </div>
              <p className="font-sohne text-xs text-sienna-brown/90 leading-relaxed">
                Unlock this monograph plus every course in the Cursusaurus catalog for $15/mo after a 7-day trial.
              </p>
              <Button
                onClick={handleSubscribe}
                disabled={isPending}
                className="w-full rounded-full bg-sienna-brown hover:bg-ink-black text-paper-white text-xs font-medium py-2.5 transition-colors"
              >
                {isPending ? "Connecting..." : "Start 7-Day Free Trial"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
