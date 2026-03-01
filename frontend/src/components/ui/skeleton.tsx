import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200", className)} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`kpi-skel-${i}`} className="rounded-xl border bg-white p-6 shadow-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <Skeleton className="h-[300px] w-full rounded" />
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <Skeleton className="h-[300px] w-full rounded" />
        </div>
      </div>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`row-skel-${i}`} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TabSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`tab-skel-${i}`} className="rounded-xl border bg-white p-6 shadow-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
