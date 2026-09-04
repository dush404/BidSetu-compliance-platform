"use client";

import { cn } from "@/lib/utils";

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} />;
}

export function RowListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card-hairline flex items-center gap-4 p-4">
          <Shimmer className="size-10 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-3.5 w-[45%] max-w-56" />
            <Shimmer className="h-2.5 w-[30%] max-w-40" />
          </div>
          <Shimmer className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-8 w-[60%] max-w-md" />
        <Shimmer className="h-3 w-[40%] max-w-xs" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <RowListSkeleton rows={5} />
    </div>
  );
}

export function BidderDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Shimmer className="h-3 w-28" />
        <Shimmer className="h-9 w-[55%] max-w-sm" />
        <div className="flex gap-2">
          <Shimmer className="h-6 w-40 rounded-full" />
          <Shimmer className="h-6 w-32 rounded-full" />
          <Shimmer className="h-6 w-36 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Shimmer className="h-52 rounded-xl" />
        <Shimmer className="h-52 rounded-xl lg:col-span-2" />
      </div>
      <Shimmer className="h-64 rounded-xl" />
    </div>
  );
}
