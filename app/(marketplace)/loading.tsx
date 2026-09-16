import { CatalogGridSkeleton } from "./catalog-content";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketplaceLoading() {
  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-8 md:py-14 flex flex-col gap-10 md:gap-14">
      {/* Hero Section Skeleton */}
      <section className="flex flex-col items-start gap-4 max-w-3xl">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <Skeleton className="h-12 md:h-16 w-3/4 rounded-md" />
        <Skeleton className="h-5 w-full max-w-xl rounded-md" />
      </section>

      {/* Search & Filter Skeleton */}
      <section className="flex flex-col gap-4 border-b border-hairline pb-8">
        <Skeleton className="h-12 w-full max-w-xl rounded-inputs" />
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full shrink-0" />
          ))}
        </div>
      </section>

      {/* Grid Skeleton */}
      <CatalogGridSkeleton />
    </div>
  );
}
