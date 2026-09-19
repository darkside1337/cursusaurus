"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1.5 font-sohne rounded-full text-sm font-medium whitespace-nowrap transition-all outline-hidden cursor-pointer hover:bg-mist-gray/60 hover:text-ink-black focus-visible:ring-2 focus-visible:ring-ink-black/20 disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-mist-gray aria-pressed:text-ink-black data-[state=on]:bg-mist-gray data-[state=on]:text-ink-black [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent text-slate-gray",
        outline: "border border-hairline bg-transparent hover:bg-mist-gray/60 text-slate-gray data-[state=on]:border-ink-black/20 data-[state=on]:bg-mist-gray data-[state=on]:text-ink-black",
      },
      size: {
        default: "h-9 min-w-9 px-3",
        sm: "h-7 min-w-7 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 min-w-10 px-4 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
