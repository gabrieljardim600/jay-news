import { Skeleton } from "@/components/ui/Skeleton";

export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* Masthead */}
      <div className="flex flex-col gap-2 mb-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-52" />
      </div>

      {/* Highlight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-48 md:col-span-2 rounded-md" />
        <Skeleton className="h-48 rounded-md" />
      </div>

      {/* Category sections */}
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-36" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex flex-col gap-1.5 py-2 border-b border-border/20">
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
