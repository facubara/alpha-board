/**
 * Analytics page loading skeleton.
 */
export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <div className="h-7 w-32 rounded bg-[var(--bg-muted)]" />
        <div className="mt-2 h-4 w-64 rounded bg-[var(--bg-muted)]" />
      </div>

      {/* Disclaimer skeleton */}
      <div className="h-9 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]" />

      {/* Tab bar skeleton */}
      <div className="flex gap-4 border-b border-[var(--border-default)] pb-2">
        {["w-20", "w-24", "w-18", "w-14"].map((w, i) => (
          <div key={i} className={`h-5 ${w} rounded bg-[var(--bg-muted)]`} />
        ))}
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2"
          >
            <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
            <div className="mt-2 h-6 w-24 rounded bg-[var(--bg-muted)]" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div>
        <div className="mb-2 h-4 w-48 rounded bg-[var(--bg-muted)]" />
        <div className="h-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]" />
      </div>

      {/* Bar charts skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 h-4 w-32 rounded bg-[var(--bg-muted)]" />
          <div className="h-32 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]" />
        </div>
        <div>
          <div className="mb-2 h-4 w-32 rounded bg-[var(--bg-muted)]" />
          <div className="h-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]" />
        </div>
      </div>
    </div>
  );
}
