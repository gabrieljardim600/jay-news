import { MarketsListSkeleton } from "@/components/markets/MarketsListSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <Skeleton className="h-10 w-56 rounded-full mb-6" />
      <MarketsListSkeleton />
    </div>
  );
}
