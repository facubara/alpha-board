/**
 * Processing page loading skeleton.
 */
export default function ProcessingLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-48 rounded-none bg-void-muted skeleton" />
        <div className="mt-2 h-4 w-80 rounded-none bg-void-muted skeleton" />
      </div>

      {/* Task cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-none border border-void-border bg-void-surface p-4"
          >
            <div className="h-4 w-28 rounded-none bg-void-muted skeleton" />
            <div className="mt-3 h-8 w-16 rounded-none bg-void-muted skeleton" />
            <div className="mt-2 h-3 w-20 rounded-none bg-void-muted skeleton" />
            <div className="mt-4 h-8 w-full rounded-none bg-void-muted skeleton" />
          </div>
        ))}
      </div>

      {/* Run history table */}
      <div className="space-y-3">
        <div className="h-5 w-28 rounded-none bg-void-muted skeleton" />
        <div className="rounded-none border border-void-border bg-void-surface">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-void-border px-4 py-3 last:border-b-0"
            >
              <div className="h-4 w-32 rounded-none bg-void-muted skeleton" />
              <div className="h-4 w-20 rounded-none bg-void-muted skeleton" />
              <div className="h-4 w-16 rounded-none bg-void-muted skeleton" />
              <div className="h-4 w-24 rounded-none bg-void-muted skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
