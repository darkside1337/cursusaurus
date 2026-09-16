"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-fog-white flex items-center justify-center px-4">
      <Card className="max-w-md w-full bg-paper-white rounded-cards border border-hairline p-10 md:p-12 text-center flex flex-col items-center justify-center gap-4">
        <div className="size-14 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
          <AlertTriangle className="size-6 stroke-[1.5]" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl md:text-3xl text-ink-black font-normal">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-gray font-sohne leading-relaxed">
            We hit an unexpected error while rendering this page. Please try
            again.
          </p>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <Button
            onClick={reset}
            className="rounded-full bg-ink-black text-paper-white px-6 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}