// =============================================================================
// Nucleus AI — Skeleton Loaders
// =============================================================================
// Shimmer-based loading placeholders with card / list / table / stat variants.
// =============================================================================

import { cn } from '@/lib/utils';

/** Base shimmer block. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md', className)} />;
}

/** A loading placeholder for a stat / metric card. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-6 w-16" />
          <SkeletonBlock className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

/** A loading placeholder for a content card. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-5', className)}>
      <SkeletonBlock className="mb-4 h-5 w-1/3" />
      <div className="space-y-2.5">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-5/6" />
        <SkeletonBlock className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/** A loading placeholder for a list of rows. */
export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonBlock className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-1/2" />
            <SkeletonBlock className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A loading placeholder for a data table. */
export function SkeletonTable({
  rows = 6,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border', className)}>
      <div className="flex gap-4 border-b bg-muted/30 p-3">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b p-3 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
