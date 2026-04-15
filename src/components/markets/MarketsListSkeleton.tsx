import { Skeleton } from "@/components/ui/Skeleton";

export function MarketsListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="p-4 rounded-[14px] bg-surface border border-border">
          <div className="flex items-start gap-3 mb-3">
            <Skeleton className="w-11 h-11 rounded-[12px]" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MarketDetailSkeleton() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="w-9 h-9 rounded-full" />
        <Skeleton className="w-11 h-11 rounded-[12px]" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-60" />
        </div>
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-10">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-[12px]" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 p-3 mb-2 rounded-[12px] bg-surface border border-border">
          <Skeleton className="w-16 h-16 rounded-[8px]" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
