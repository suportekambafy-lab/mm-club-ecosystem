import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto do MM Inteligence — mesma estrutura do chat para evitar salto visual. */
export function JadeChatSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-hidden px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-64 max-w-full" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-12 w-2/3 rounded-2xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[70%]" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-1/2 rounded-2xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[88%]" />
            <Skeleton className="h-4 w-[60%]" />
          </div>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
