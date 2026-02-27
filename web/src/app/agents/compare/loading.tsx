/**
 * Comparison page loading skeleton.
 */
export default function CompareLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="h-7 w-48 rounded bg-[var(--bg-muted)] skeleton" />
        <div className="mt-2 h-4 w-64 rounded bg-[var(--bg-muted)] skeleton" />
      </div>

      {/* Agent chips skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-36 rounded-full bg-[var(--bg-muted)] skeleton" />
        ))}
      </div>

      {/* Metrics grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
          >
            <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="mt-3 h-5 w-20 rounded bg-[var(--bg-muted)] skeleton" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]" />

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-10 items-center gap-6 border-t border-[var(--border-subtle)] px-4 first:border-t-0"
          >
            <div className="h-3 w-24 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="h-3 w-12 rounded bg-[var(--bg-muted)] skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
