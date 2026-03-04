/**
 * Status page loading skeleton.
 */
export default function StatusLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-40 rounded-none bg-void-muted skeleton" />
        <div className="mt-2 h-4 w-80 rounded-none bg-void-muted skeleton" />
      </div>

      {/* Status banner */}
      <div className="h-12 rounded-none border border-void-border bg-void-surface skeleton" />

      {/* Service rows */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-none border border-void-border bg-void-surface px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-void-muted skeleton" />
              <div className="h-4 w-32 rounded-none bg-void-muted skeleton" />
            </div>
            <div className="flex items-center gap-6">
              <div className="h-3 w-16 rounded-none bg-void-muted skeleton" />
              <div className="h-6 w-48 rounded-none bg-void-muted skeleton" />
            </div>
          </div>
        ))}
      </div>

      {/* LLM settings section */}
      <div className="space-y-3">
        <div className="h-5 w-28 rounded-none bg-void-muted skeleton" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-none border border-void-border bg-void-surface skeleton"
          />
        ))}
      </div>
    </div>
  );
}
