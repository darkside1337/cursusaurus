import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full min-w-0 rounded-inputs border border-transparent bg-mist-gray px-3.5 py-2.5 font-sohne text-sm text-ink-black transition-colors outline-none placeholder:text-smoke-gray focus-visible:border-slate-gray/50 focus-visible:ring-1 focus-visible:ring-ink-black/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
