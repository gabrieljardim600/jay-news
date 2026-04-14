import { Skeleton } from "@/components/ui/Skeleton";

export function FeedSkeleton() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10">
      <div className="flex flex-col gap-3 mb-8">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="flex gap-3 mb-8 overflow-hidden">
        <Skeleton className="h-[260px] w-[280px] rounded-[16px] shrink-0" />
        <Skeleton className="h-[260px] w-[280px] rounded-[16px] shrink-0" />
        <Skeleton className="h-[260px] w-[280px] rounded-[16px] shrink-0" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-4 mb-6">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex flex-col gap-2 py-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
