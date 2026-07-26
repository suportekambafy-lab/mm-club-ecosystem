import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shared skeleton primitives so every async page shows the real page structure
 * immediately (LinkedIn/YouTube style) instead of empty backgrounds or
 * placeholder covers that get swapped a second later.
 */

export function TextLines({
  lines = 2,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SectionHeadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 px-1", className)}>
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

/** 21/9 (desktop) cinematic hero placeholder — matches the dashboard hero box. */
export function CinematicHeroSkeleton() {
  return (
    <section className="relative -mx-3 overflow-hidden sm:-mx-4 md:-mx-8">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-1 md:aspect-[21/9]">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-tr from-surface-2 via-surface-1 to-surface-2" />
        <div className="absolute inset-0 flex items-end">
          <div className="w-full space-y-4 px-6 pb-8 md:px-14 md:pb-16">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-10 w-[70%] max-w-xl md:h-16" />
            <Skeleton className="h-4 w-56 md:w-80" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Wide 16/9 banner used by live banners and "continue watching" heroes. */
export function BannerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl ring-1 ring-border md:flex-row",
        className,
      )}
    >
      <div className="aspect-[16/9] animate-pulse bg-surface-2 md:aspect-auto md:h-[280px] md:w-[55%]" />
      <div className="flex flex-1 flex-col justify-between gap-6 bg-surface-1 p-6 md:p-8">
        <div className="space-y-3">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center gap-3 pt-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-1 w-full rounded-full" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function CourseCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border",
        className,
      )}
    >
      <div className="aspect-[16/9] animate-pulse bg-surface-2" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Horizontal rail: title block + N cards, same widths as the real rails. */
export function RailSkeleton({
  cards = 3,
  cardClassName = "w-[340px] shrink-0",
}: {
  cards?: number;
  cardClassName?: string;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-2.5 px-1">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="-mx-1 flex gap-4 overflow-hidden px-1 pb-2">
        {Array.from({ length: cards }).map((_, i) => (
          <CourseCardSkeleton key={i} className={cardClassName} />
        ))}
      </div>
    </section>
  );
}

export function CardGridSkeleton({
  cards = 4,
  className = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: cards }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PanelSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-surface-1 p-6 ring-1 ring-border", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-5 w-32" />
      </div>
      <TextLines lines={lines} className="mt-4" />
    </div>
  );
}
