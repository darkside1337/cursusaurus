import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-buttons border border-transparent px-2.5 py-0.5 font-sohne text-[14px] font-[450] leading-none whitespace-nowrap transition-all focus-visible:border-ink-black/40 focus-visible:ring-1 focus-visible:ring-ink-black/20 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "bg-blush-peach text-sienna-brown [a]:hover:bg-blush-peach/90",
        allAccess:
          "bg-blush-peach text-sienna-brown [a]:hover:bg-blush-peach/90",
        purchased:
          "bg-mist-gray text-ink-black [a]:hover:bg-mist-gray/80",
        locked:
          "border-transparent bg-transparent text-ash-gray [a]:hover:text-ink-black",
        outline:
          "border-slate-gray/30 bg-transparent text-ink-black [a]:hover:bg-mist-gray/50",
        secondary:
          "bg-mist-gray text-ink-black [a]:hover:bg-mist-gray/80",
        destructive:
          "bg-destructive/10 text-destructive [a]:hover:bg-destructive/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
