"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, className, showLabel }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <Progress
        value={clamped}
        className="w-full"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      {showLabel && (
        <p className="text-xs font-medium text-slate-gray text-right font-sohne">
          {clamped}% completed
        </p>
      )}
    </div>
  );
}
