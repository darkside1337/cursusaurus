"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface OrderStatusData {
  status: "pending" | "completed" | "failed";
  type: "purchase" | "subscription";
  courseId?: string;
  courseSlug?: string;
  courseTitle?: string;
  isEntitled: boolean;
}

export function OrderStatusView({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<OrderStatusData | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const maxAttempts = 20;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let isMounted = true;

    async function pollStatus() {
      try {
        const res = await fetch(`/api/order-status/${sessionId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Order session not found or does not belong to your account.");
            return;
          }
          throw new Error(`Failed to fetch order status: ${res.status}`);
        }

        const result: OrderStatusData = await res.json();
        if (!isMounted) return;

        setData(result);

        if (result.status === "completed" || result.status === "failed") {
          return; // Polling complete
        }

        setAttempts((prev) => {
          const next = prev + 1;
          if (next < maxAttempts) {
            timer = setTimeout(pollStatus, 1500);
          }
          return next;
        });
      } catch (err) {
        console.error("Polling order status error:", err);
        setAttempts((prev) => {
          const next = prev + 1;
          if (next < maxAttempts) {
            timer = setTimeout(pollStatus, 2000);
          }
          return next;
        });
      }
    }

    pollStatus();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [sessionId]);

  // State C: Explicit error or failed status
  if (error || data?.status === "failed") {
    return (
      <Card className="p-8 sm:p-10 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col items-center text-center gap-6">
        <div className="size-12 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
          <XCircle className="size-6 text-slate-gray" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl sm:text-3xl text-ink-black font-normal">
            Order Unsuccessful
          </h1>
          <p className="text-slate-gray text-sm leading-relaxed max-w-md">
            {error || "Your checkout session could not be completed or expired. No charges were made."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            render={<Link href="/" />}
            className="rounded-full bg-ink-black text-paper-white px-6 text-sm"
          >
            Return to Catalog
          </Button>
          <Button
            variant="ghost"
            render={<Link href="/billing" />}
            className="rounded-full text-slate-gray hover:text-ink-black text-sm"
          >
            Billing Overview
          </Button>
        </div>
      </Card>
    );
  }

  // State B: Confirmed receipt prospectus
  if (data?.status === "completed") {
    const isSubscription = data.type === "subscription";

    return (
      <Card className="p-8 sm:p-10 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col gap-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="size-12 rounded-full bg-blush-peach/40 text-sienna-brown flex items-center justify-center">
            <CheckCircle2 className="size-6 text-sienna-brown" />
          </div>

          <div className="flex flex-col gap-1.5 items-center">
            {isSubscription ? (
              <Badge className="bg-blush-peach text-sienna-brown border-none text-xs px-3 py-0.5 rounded-full font-medium">
                ALL-ACCESS PASS
              </Badge>
            ) : (
              <Badge className="bg-mist-gray text-ink-black border border-hairline text-xs px-3 py-0.5 rounded-full font-medium">
                PERMANENT PURCHASE
              </Badge>
            )}

            <h1 className="font-serif text-2xl sm:text-3xl text-ink-black font-normal mt-1">
              {isSubscription ? "All-Access Membership Activated" : data.courseTitle || "Course Monograph Enrolled"}
            </h1>

            <p className="text-slate-gray text-sm leading-relaxed max-w-md">
              {isSubscription
                ? "Your 7-day free trial is now active. You have full, unrestricted access to every monograph and syllabus in the Cursusaurus catalog."
                : "Your acquisition has been completed. Lifetime ownership has been granted to your account."}
            </p>
          </div>
        </div>

        <Separator className="bg-hairline" />

        {/* Receipt prospectus metadata */}
        <div className="flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between text-slate-gray">
            <span>Order Reference</span>
            <span className="font-mono text-ink-black truncate max-w-[200px] sm:max-w-[300px]">
              {sessionId}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-gray">
            <span>Access Model</span>
            <span className="text-ink-black font-medium">
              {isSubscription ? "All-Access Pass ($15/mo after 7-day trial)" : "Perpetual License"}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-gray">
            <span>Fulfillment Status</span>
            <span className="text-ink-black font-medium flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-sienna-brown" />
              <span>Entitlement Confirmed</span>
            </span>
          </div>
        </div>

        <Separator className="bg-hairline" />

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="ghost"
              render={<Link href="/library" />}
              className="text-xs text-slate-gray hover:text-ink-black rounded-full px-4"
            >
              My Library
            </Button>
            <Button
              variant="ghost"
              render={<Link href="/billing" />}
              className="text-xs text-slate-gray hover:text-ink-black rounded-full px-4"
            >
              Billing
            </Button>
          </div>

          {isSubscription ? (
            <Button
              render={<Link href="/" />}
              className="w-full sm:w-auto rounded-full bg-ink-black text-paper-white px-6 py-2.5 text-xs font-medium hover:opacity-90 gap-1.5"
            >
              <span>Browse Catalog</span>
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              render={<Link href={`/${data.courseSlug}`} />}
              className="w-full sm:w-auto rounded-full bg-ink-black text-paper-white px-6 py-2.5 text-xs font-medium hover:opacity-90 gap-1.5"
            >
              <span>Start Watching</span>
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // State C-still-processing: Polling exhausted but still pending
  if (attempts >= maxAttempts && data?.status === "pending") {
    return (
      <Card className="p-8 sm:p-10 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col items-center text-center gap-6">
        <div className="size-12 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
          <Clock className="size-6 text-slate-gray" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl sm:text-3xl text-ink-black font-normal">
            Still Confirming Payment
          </h1>
          <p className="text-slate-gray text-sm leading-relaxed max-w-md">
            Your transaction is currently being confirmed by the payment network. Webhook delivery can occasionally take a few moments. Your access will appear in your library and billing ledger shortly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            render={<Link href="/billing" />}
            className="rounded-full bg-ink-black text-paper-white px-6 text-sm"
          >
            Check Billing
          </Button>
          <Button
            variant="ghost"
            render={<Link href="/library" />}
            className="rounded-full text-slate-gray hover:text-ink-black text-sm"
          >
            Go to Library
          </Button>
        </div>
      </Card>
    );
  }

  // State A: Initial polling / confirming order
  return (
    <Card className="p-8 sm:p-12 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col items-center text-center gap-6">
      <div className="relative flex items-center justify-center">
        <div className="size-16 rounded-full border-2 border-hairline border-t-ink-black animate-spin" />
        <div className="absolute size-3 rounded-full bg-sienna-brown" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl sm:text-3xl text-ink-black font-normal">
          Confirming Order
        </h2>
        <p className="text-slate-gray text-sm leading-relaxed max-w-sm">
          Verifying payment authorization and enrolling course entitlements...
        </p>
      </div>

      <div className="w-full max-w-xs mt-2">
        <Progress value={Math.min(100, Math.max(10, attempts * 10))} className="h-1 bg-mist-gray" />
      </div>
    </Card>
  );
}
