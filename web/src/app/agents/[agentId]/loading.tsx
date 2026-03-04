/**
 * Agent detail loading skeleton.
 */
export default function AgentDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-7 w-52 rounded-none bg-void-muted skeleton" />
          <div className="mt-2 flex gap-2">
            <div className="h-5 w-20 rounded-none bg-void-muted skeleton" />
            <div className="h-5 w-10 rounded-none bg-void-muted skeleton" />
            <div className="h-5 w-14 rounded-none bg-void-muted skeleton" />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-10 w-20 rounded-none bg-void-muted skeleton" />
          <div className="h-10 w-20 rounded-none bg-void-muted skeleton" />
        </div>
      </div>

      {/* Disclaimer skeleton */}
      <div className="h-8 rounded-none bg-void-surface" />

      {/* Tab bar skeleton */}
      <div className="flex gap-4 border-b border-void-border pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-5 w-20 rounded-none bg-void-muted skeleton" />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-40 rounded-none border border-void-border bg-void-surface" />

      {/* Metrics grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-none border border-void-border bg-void-surface"
          />
        ))}
      </div>
    </div>
  );
}
