import { Skeleton } from "@/components/ui/Skeleton";

interface ShellSkeletonProps {
  variant?: "feed" | "markets" | "detail";
}

function Pill({ w = "w-16" }: { w?: string }) {
  return <Skeleton className={`h-8 ${w} rounded-full`} />;
}

export function ShellSkeleton({ variant = "feed" }: ShellSkeletonProps) {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-28">
      {/* Header shell */}
      <div className="flex flex-col gap-5 mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full ml-1" />
          </div>
        </div>
        {/* ModeNav placeholder */}
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border w-fit">
          <Pill />
          <Pill />
          <Pill w="w-20" />
        </div>
      </div>

      {variant === "markets" ? (
        <>
          <div className="flex flex-col gap-1.5 mb-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[120px] rounded-[14px]" />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Tabs shell */}
          <div className="flex gap-2 mb-6 overflow-hidden">
            <Pill w="w-20" />
            <Pill w="w-24" />
            <Pill w="w-16" />
          </div>
          {/* Date selector shell */}
          <Skeleton className="h-8 w-full rounded-full mb-6" />
          {/* Content */}
          <div className="flex flex-col gap-4">
            <Skeleton className="h-16 w-full rounded-[14px]" />
            <div className="flex gap-3 overflow-hidden">
              <Skeleton className="h-[220px] w-[260px] rounded-[16px] shrink-0" />
              <Skeleton className="h-[220px] w-[260px] rounded-[16px] shrink-0" />
              <Skeleton className="h-[220px] w-[260px] rounded-[16px] shrink-0" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-2 mt-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
