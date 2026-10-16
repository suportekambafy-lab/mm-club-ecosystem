import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ variant = "table" }: { variant?: "table" | "home" | "sales" | "team" }) {
  return <div role="status" aria-label="A carregar página" aria-busy="true" className="space-y-9 motion-reduce:[&_*]:animate-none">
    <div aria-hidden="true" className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
      <div className="space-y-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-64 max-w-full" /><Skeleton className="h-4 w-72 max-w-full" /></div><Skeleton className="h-11 w-36" />
    </div>
    {variant !== "team" && <div aria-hidden="true" className={`grid grid-cols-2 gap-6 border-b border-border pb-8 ${variant === "sales" ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
      {Array.from({ length: variant === "sales" ? 3 : 4 }, (_, i) => <div key={i} className="space-y-4"><Skeleton className="h-3 w-28 max-w-full" /><Skeleton className="h-9 w-24" /><Skeleton className="h-3 w-20" /></div>)}
    </div>}
    {variant === "team" ? <div aria-hidden="true" className="grid gap-8 md:grid-cols-3"><Skeleton className="h-40 w-full" />{[0, 1].map(i => <div key={i} className="space-y-4"><Skeleton className="aspect-[4/5] w-full" /><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-48 max-w-full" /></div>)}</div> : <div aria-hidden="true" className="space-y-5">
      <Skeleton className="h-6 w-52" />
      {variant === "table" && <div className="flex flex-wrap gap-3"><Skeleton className="h-10 w-60 max-w-full" /><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-32" /></div>}
      <div className="border-y border-border">{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center gap-4 border-b border-border py-5 last:border-0"><Skeleton className="h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-44 max-w-full" /><Skeleton className="h-3 w-28" /></div><Skeleton className="h-6 w-20" /><Skeleton className="hidden h-4 w-24 sm:block" /></div>)}</div>
    </div>}
  </div>;
}

export function HomeSkeleton() { return <PageSkeleton variant="home" />; }
export function SalesSkeleton() { return <PageSkeleton variant="sales" />; }
export function TeamSkeleton() { return <PageSkeleton variant="team" />; }

export function RouteSkeleton() {
  return <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12"><PageSkeleton /></div>;
}

export function CommercialShellSkeleton() {
  return <div className="admin-shell commercial-shell min-h-screen bg-background text-foreground motion-reduce:[&_*]:animate-none">
    <aside aria-hidden="true" className="commercial-sidebar"><div className="flex items-center gap-3 px-3 py-3"><Skeleton className="h-9 w-9" /><Skeleton className="h-6 w-24" /></div><div className="commercial-nav mt-12 flex gap-2 md:flex-col">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div></aside>
    <div className="commercial-workspace"><div aria-hidden="true" className="commercial-topbar flex h-16 items-center justify-between border-b border-border px-5 md:px-9"><Skeleton className="h-5 w-40" /><Skeleton className="h-8 w-8 rounded-full" /></div><div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12"><HomeSkeleton /></div></div>
  </div>;
}