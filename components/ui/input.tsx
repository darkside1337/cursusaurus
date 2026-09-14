import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-inputs border border-transparent bg-mist-gray px-3.5 py-2 font-sohne text-sm text-ink-black transition-colors outline-none placeholder:text-smoke-gray focus-visible:border-slate-gray/50 focus-visible:ring-1 focus-visible:ring-ink-black/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink-black",
        className
      )}
      {...props}
    />
  )
}

export { Input }
