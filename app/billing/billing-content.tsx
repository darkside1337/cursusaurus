"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldCheck,
  ArrowRight,
  Receipt,
  Sparkles,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPriceCents } from "@/lib/format-price";
import {
  createSubscriptionCheckoutSessionAction,
  manageSubscriptionAction,
} from "@/features/subscriptions/actions";
import type { Subscription } from "@/features/subscriptions/types";
import type { UserPurchasedCourseItem } from "@/features/purchases/queries";

interface BillingContentProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  subscription: Subscription | null;
  purchases: UserPurchasedCourseItem[];
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingContent({
  user,
  subscription,
  purchases,
}: BillingContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isTrial = subscription?.status === "trialing";
  const isActive = subscription?.status === "active";
  const isPastDue = subscription?.status === "past_due";
  const hasLiveSubscription = isTrial || isActive;

  function handleStartSubscription() {
    startTransition(async () => {
      try {
        const res = await createSubscriptionCheckoutSessionAction("/billing");
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.redirectTo) {
          router.push(res.redirectTo);
          return;
        }
        if (res.url) {
          window.location.href = res.url;
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to initiate subscription");
      }
    });
  }

  function handleOpenPortal() {
    startTransition(async () => {
      try {
        const res = await manageSubscriptionAction();
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.url) {
          window.location.href = res.url;
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to open customer portal");
      }
    });
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="max-w-[780px] mx-auto flex flex-col gap-10">
        {/* Eyebrow & Page Heading */}
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-sohne text-xs uppercase tracking-widest text-ash-gray font-medium">
              Account Settings & Preferences
            </span>
            <span className="font-mono text-xs text-ash-gray">
              {user.email}
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink-black font-normal">
            Billing & Subscriptions
          </h1>
          <p className="font-sohne text-sm sm:text-base text-slate-gray leading-relaxed">
            Manage your All-Access membership, renewal cadence, payment instruments, and standalone perpetual course licenses.
          </p>
        </header>

        {/* PRD Invariant Callout: Perpetual Ownership Guarantee */}
        <Card className="p-5 sm:p-6 bg-paper-white rounded-cards border border-hairline shadow-subtle flex items-start gap-4">
          <div className="size-8 rounded-full bg-blush-peach text-sienna-brown flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="size-4 text-sienna-brown" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-sohne text-sm font-medium text-ink-black">
              Perpetual Ownership Guarantee
            </h2>
            <p className="font-sohne text-xs sm:text-sm text-slate-gray leading-relaxed">
              Courses purchased outright remain yours in perpetuity, even if your All-Access membership expires or is canceled. Standalone purchases are decoupled from subscription state and can always be accessed from{" "}
              <Link href="/library" className="text-ink-black font-medium hover:underline">
                My Library
              </Link>.
            </p>
          </div>
        </Card>

        {/* Section 1: Membership Status */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-sohne text-xs uppercase tracking-wider text-ash-gray font-medium">
              Membership Status
            </span>
          </div>

          {/* Active Subscription */}
          {isActive && (
            <Card className="p-6 sm:p-8 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="font-sohne text-lg font-medium text-ink-black">
                    All-Access Pass — Active
                  </h3>
                  <span className="font-sohne text-xs text-slate-gray">
                    {subscription.cancelAtPeriodEnd
                      ? `Access active until ${formatDate(subscription.currentPeriodEnd)} · Cancellation scheduled`
                      : `Renews ${formatDate(subscription.currentPeriodEnd)} · Billed monthly`}
                  </span>
                </div>
                <Badge className="bg-blush-peach text-sienna-brown border-none font-sohne text-xs px-3 py-1 rounded-full font-medium">
                  All-Access
                </Badge>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl text-ink-black font-normal">$15</span>
                <span className="font-sohne text-xs text-slate-gray">/ month</span>
              </div>

              <Separator className="bg-hairline" />

              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="font-sohne text-xs text-slate-gray">
                  Self-service invoice history, payment card updates, and cancellations
                </span>
                <Button
                  onClick={handleOpenPortal}
                  disabled={isPending}
                  className="rounded-full bg-ink-black text-paper-white px-5 text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  {isPending ? "Opening..." : "Manage on Stripe Customer Portal"}
                </Button>
              </div>
            </Card>
          )}

          {/* Trial Subscription */}
          {isTrial && (
            <Card className="p-6 sm:p-8 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-sienna-brown" />
                    <h3 className="font-sohne text-lg font-medium text-ink-black">
                      All-Access Pass — 7-Day Free Trial
                    </h3>
                  </div>
                  <span className="font-sohne text-xs text-slate-gray">
                    Trial active until {formatDate(subscription.trialEndsAt || subscription.currentPeriodEnd)} · Converts to $15/mo
                  </span>
                </div>
                <Badge className="bg-blush-peach text-sienna-brown border-none font-sohne text-xs px-3 py-1 rounded-full font-medium">
                  Free Trial
                </Badge>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl text-ink-black font-normal">$0</span>
                <span className="font-sohne text-xs text-slate-gray">during trial, then $15 / month</span>
              </div>

              <Separator className="bg-hairline" />

              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="font-sohne text-xs text-slate-gray">
                  Cancel anytime before trial ends without charge
                </span>
                <Button
                  onClick={handleOpenPortal}
                  disabled={isPending}
                  className="rounded-full bg-ink-black text-paper-white px-5 text-xs font-medium hover:opacity-90"
                >
                  {isPending ? "Opening..." : "Manage on Stripe Customer Portal"}
                </Button>
              </div>
            </Card>
          )}

          {/* Past Due Subscription */}
          {isPastDue && (
            <Card className="p-6 sm:p-8 bg-paper-white rounded-cards border border-amber-300 shadow-subtle flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="size-4 text-amber-600" />
                    <h3 className="font-sohne text-lg font-medium">
                      All-Access Pass — Payment Past Due
                    </h3>
                  </div>
                  <span className="font-sohne text-xs text-slate-gray">
                    Renewal payment failed · Catalog access is currently paused
                  </span>
                </div>
                <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50 text-xs px-3 py-1 rounded-full font-medium">
                  Past Due
                </Badge>
              </div>

              <p className="font-sohne text-xs text-slate-gray leading-relaxed">
                Your recent subscription renewal was declined by your bank or card issuer. Please update your payment instrument in the Stripe Customer Portal to restore All-Access entitlement immediately.
              </p>

              <Separator className="bg-hairline" />

              <div className="flex justify-end">
                <Button
                  onClick={handleOpenPortal}
                  disabled={isPending}
                  className="rounded-full bg-amber-900 hover:bg-ink-black text-paper-white px-5 text-xs font-medium"
                >
                  {isPending ? "Opening..." : "Update Payment Method"}
                </Button>
              </div>
            </Card>
          )}

          {/* Inactive / No Subscription */}
          {!hasLiveSubscription && !isPastDue && (
            <Card className="p-6 sm:p-8 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="font-sohne text-lg font-medium text-ash-gray">
                    No active subscription
                  </h3>
                  <span className="font-sohne text-xs text-slate-gray">
                    All-Access catalog unlocked on demand
                  </span>
                </div>
                <Badge className="bg-mist-gray text-slate-gray border-none text-xs px-3 py-1 rounded-full">
                  Inactive
                </Badge>
              </div>

              <p className="font-sohne text-xs sm:text-sm text-slate-gray leading-relaxed">
                Unlock unlimited access to the complete catalog of monograph syllabi, curated workshops, and technical deep dives with a 7-day free trial.
              </p>

              <div className="pt-2 border-t border-hairline flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-2xl text-ink-black font-normal">$15</span>
                  <span className="font-sohne text-xs text-slate-gray">/ month (7 days free)</span>
                </div>
                <Button
                  onClick={handleStartSubscription}
                  disabled={isPending}
                  className="rounded-full bg-ink-black text-paper-white px-6 py-2.5 text-xs font-medium hover:opacity-90"
                >
                  {isPending ? "Connecting..." : "Start 7-Day Free Trial"}
                </Button>
              </div>
            </Card>
          )}
        </section>

        {/* Section 2: Standalone Purchased Courses Ledger */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-sohne text-lg font-medium text-ink-black">
              Purchased Courses
            </h2>
            <p className="font-sohne text-xs text-slate-gray">
              Lifetime access licenses owned in perpetuity outside of subscription access.
            </p>
          </div>

          {purchases.length > 0 ? (
            <div className="flex flex-col gap-3">
              {purchases.map((item) => (
                <Card
                  key={item.id}
                  className="p-5 bg-paper-white rounded-smallcards border border-hairline shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-2">
                    <span className="font-sohne text-sm font-medium text-ink-black truncate">
                      {item.course.title}
                    </span>
                    <p className="font-sohne text-xs text-slate-gray">
                      Purchased {formatDate(item.purchasedAt)} · {formatPriceCents(item.pricePaidCents ?? item.course.priceCents)} USD
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-gray font-sohne flex items-center gap-1.5 px-2">
                      <Receipt className="size-3.5 text-slate-gray/70" />
                      <span>Receipts go to {user.email}</span>
                    </span>
                    <Button
                      size="sm"
                      render={<Link href={`/${item.course.slug}`} />}
                      className="rounded-full bg-ink-black text-paper-white text-xs px-4 gap-1 font-medium hover:opacity-90"
                    >
                      <span>Open Course</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 bg-fog-white rounded-cards border border-hairline text-center flex flex-col items-center justify-center gap-2">
              <BookOpen className="size-6 text-slate-gray/50" />
              <h3 className="font-sohne text-sm font-medium text-ink-black">
                No standalone purchases yet
              </h3>
              <p className="font-sohne text-xs text-slate-gray max-w-sm">
                Courses acquired individually will appear in this ledger with permanent ownership licenses and receipts.
              </p>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
