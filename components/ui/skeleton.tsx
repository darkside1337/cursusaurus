import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-images bg-mist-gray", className)}
      {...props}
    />
  )
}

export { Skeleton }
