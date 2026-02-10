/**
 * Agent detail loading skeleton.
 */
export default function AgentDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-7 w-52 rounded bg-[var(--bg-muted)]" />
          <div className="mt-2 flex gap-2">
            <div className="h-5 w-20 rounded bg-[var(--bg-muted)]" />
            <div className="h-5 w-10 rounded bg-[var(--bg-muted)]" />
            <div className="h-5 w-14 rounded bg-[var(--bg-muted)]" />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-10 w-20 rounded bg-[var(--bg-muted)]" />
          <div className="h-10 w-20 rounded bg-[var(--bg-muted)]" />
        </div>
      </div>

      {/* Disclaimer skeleton */}
      <div className="h-8 rounded-md bg-[var(--bg-surface)]" />

      {/* Tab bar skeleton */}
      <div className="flex gap-4 border-b border-[var(--border-default)] pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-5 w-20 rounded bg-[var(--bg-muted)]" />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-40 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]" />

      {/* Metrics grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        ))}
      </div>
    </div>
  );
}
