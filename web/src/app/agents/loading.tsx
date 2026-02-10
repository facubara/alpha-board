/**
 * Agent leaderboard loading skeleton.
 */
export default function AgentsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <div className="h-7 w-40 rounded bg-[var(--bg-muted)]" />
        <div className="mt-2 h-4 w-72 rounded bg-[var(--bg-muted)]" />
      </div>

      {/* Filter skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-16 rounded-md bg-[var(--bg-muted)]" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
        <div className="flex h-10 items-center gap-6 bg-[var(--bg-surface)] px-4">
          <div className="h-3 w-32 rounded bg-[var(--bg-muted)]" />
          <div className="h-3 w-10 rounded bg-[var(--bg-muted)]" />
          <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
          <div className="h-3 w-12 rounded bg-[var(--bg-muted)]" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex h-10 items-center gap-6 border-t border-[var(--border-subtle)] px-4"
          >
            <div className="h-4 w-36 rounded bg-[var(--bg-muted)]" />
            <div className="h-3 w-10 rounded bg-[var(--bg-muted)]" />
            <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
            <div className="h-3 w-12 rounded bg-[var(--bg-muted)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
