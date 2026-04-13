import { Skeleton } from "@/components/ui/Skeleton";

export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* Masthead */}
      <div className="flex flex-col gap-2 mb-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Highlight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-48 md:col-span-2" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32 md:col-span-3" />
      </div>

      {/* Category sections */}
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex flex-col gap-1.5 py-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
