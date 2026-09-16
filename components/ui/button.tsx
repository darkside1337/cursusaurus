import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-buttons border border-transparent font-sohne text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-1 focus-visible:ring-ink-black/20 focus-visible:border-ink-black/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-ink-black text-paper-white hover:bg-ink-black/90 active:bg-ink-black/95",
        ghost:
          "border-ink-black bg-transparent text-ink-black hover:bg-mist-gray/60 active:bg-mist-gray",
        outline:
          "border-slate-gray/30 bg-transparent text-ink-black hover:border-slate-gray/60 hover:bg-mist-gray/40",
        secondary:
          "bg-mist-gray text-ink-black hover:bg-mist-gray/80 active:bg-mist-gray",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-1 focus-visible:ring-destructive/20",
        link: "text-ink-black underline-offset-4 hover:text-slate-gray hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-buttons px-2 text-xs in-data-[slot=button-group]:rounded-buttons has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-buttons px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-buttons has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8 rounded-buttons",
        "icon-xs":
          "size-6 rounded-buttons in-data-[slot=button-group]:rounded-buttons [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-buttons in-data-[slot=button-group]:rounded-buttons",
        "icon-lg": "size-9 rounded-buttons",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  // If rendering a non-button element (e.g. Next.js <Link>), default nativeButton to false
  // to avoid Base UI runtime warning about missing button semantics.
  const resolvedNativeButton =
    nativeButton !== undefined
      ? nativeButton
      : render && typeof render === "object" && "type" in render && render.type !== "button"
      ? false
      : undefined;

  return (
    <ButtonPrimitive
      data-slot="button"
      render={render}
      nativeButton={resolvedNativeButton}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
