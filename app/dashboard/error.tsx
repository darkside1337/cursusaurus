"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DashboardErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardErrorBoundary({
  error,
  reset,
}: DashboardErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-12 flex items-start justify-center">
      <Card className="max-w-md w-full bg-paper-white rounded-cards border border-hairline p-10 md:p-12 text-center flex flex-col items-center justify-center gap-4">
        <div className="size-14 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
          <AlertTriangle className="size-6 stroke-[1.5]" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl md:text-3xl text-ink-black font-normal">
            Workspace error
          </h1>
          <p className="text-sm text-slate-gray font-sohne leading-relaxed">
            Something went wrong in your creator workspace. Please try again.
          </p>
        </div>

        <Button
          onClick={reset}
          className="mt-2 rounded-full bg-ink-black text-paper-white px-6 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </Button>
      </Card>
    </div>
  );
}