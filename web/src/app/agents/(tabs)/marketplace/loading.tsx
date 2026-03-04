/**
 * Agent leaderboard loading skeleton.
 */
export default function AgentsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <div className="h-7 w-40 rounded-none bg-void-muted skeleton" />
        <div className="mt-2 h-4 w-72 rounded-none bg-void-muted skeleton" />
      </div>

      {/* Filter skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-16 rounded-none bg-void-muted skeleton" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-none border border-void-border">
        <div className="flex h-10 items-center gap-6 bg-void-surface px-4">
          <div className="h-3 w-32 rounded-none bg-void-muted skeleton" />
          <div className="h-3 w-10 rounded-none bg-void-muted skeleton" />
          <div className="h-3 w-16 rounded-none bg-void-muted skeleton" />
          <div className="h-3 w-12 rounded-none bg-void-muted skeleton" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex h-10 items-center gap-6 border-t border-void-border px-4"
          >
            <div className="h-4 w-36 rounded-none bg-void-muted skeleton" />
            <div className="h-3 w-10 rounded-none bg-void-muted skeleton" />
            <div className="h-3 w-16 rounded-none bg-void-muted skeleton" />
            <div className="h-3 w-12 rounded-none bg-void-muted skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
