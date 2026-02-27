/**
 * Rankings page loading skeleton.
 * Per DESIGN_SYSTEM.md: use skeletons, not spinners.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <div className="h-7 w-32 rounded bg-[var(--bg-muted)] skeleton" />
        <div className="mt-2 h-4 w-64 rounded bg-[var(--bg-muted)] skeleton" />
      </div>

      {/* Timeframe selector skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-14 rounded-md bg-[var(--bg-muted)] skeleton" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
        {/* Header */}
        <div className="flex h-10 items-center gap-4 bg-[var(--bg-surface)] px-4">
          <div className="h-3 w-8 rounded bg-[var(--bg-muted)] skeleton" />
          <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
          <div className="h-3 w-24 rounded bg-[var(--bg-muted)] skeleton" />
          <div className="h-3 w-12 rounded bg-[var(--bg-muted)] skeleton" />
        </div>
        {/* Rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex h-10 items-center gap-4 border-t border-[var(--border-subtle)] px-4"
          >
            <div className="h-3 w-6 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="h-3 w-24 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="h-1.5 w-24 rounded-full bg-[var(--bg-muted)] skeleton" />
            <div className="h-3 w-10 rounded bg-[var(--bg-muted)] skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
