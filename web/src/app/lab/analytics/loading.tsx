/**
 * Analytics page loading skeleton.
 */
export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <div className="h-7 w-32 rounded-none bg-void-muted skeleton" />
        <div className="mt-2 h-4 w-64 rounded-none bg-void-muted skeleton" />
      </div>

      {/* Disclaimer skeleton */}
      <div className="h-9 rounded-none border border-void-border bg-void-surface" />

      {/* Tab bar skeleton */}
      <div className="flex gap-4 border-b border-void-border pb-2">
        {["w-20", "w-24", "w-18", "w-14"].map((w, i) => (
          <div key={i} className={`h-5 ${w} rounded-none bg-void-muted skeleton`} />
        ))}
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-none border border-void-border bg-void-surface px-3 py-2"
          >
            <div className="h-3 w-16 rounded-none bg-void-muted skeleton" />
            <div className="mt-2 h-6 w-24 rounded-none bg-void-muted skeleton" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div>
        <div className="mb-2 h-4 w-48 rounded-none bg-void-muted skeleton" />
        <div className="h-48 rounded-none border border-void-border bg-void-surface" />
      </div>

      {/* Bar charts skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 h-4 w-32 rounded-none bg-void-muted skeleton" />
          <div className="h-32 rounded-none border border-void-border bg-void-surface" />
        </div>
        <div>
          <div className="mb-2 h-4 w-32 rounded-none bg-void-muted skeleton" />
          <div className="h-48 rounded-none border border-void-border bg-void-surface" />
        </div>
      </div>
    </div>
  );
}
