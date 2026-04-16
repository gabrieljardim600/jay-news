"use client";

function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-[10px] bg-surface ${className}`} />;
}

export function TradingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 mb-2">
        <Pulse className="h-8 w-24" />
        <Pulse className="h-8 w-40 ml-auto" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Pulse className="h-48" />
        <Pulse className="h-48" />
      </div>
      <Pulse className="h-32" />
      <Pulse className="h-36" />
      <Pulse className="h-24" />
    </div>
  );
}
