/**
 * Status page loading skeleton — matches split-pane layout.
 */
export default function StatusLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-void-border pb-2">
        <div className="h-6 w-56 bg-void-muted skeleton" />
      </div>

      {/* Status banner */}
      <div className="h-14 border border-void-border bg-void-surface skeleton" />

      {/* Split-pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
        {/* Left pane */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* LLM grid */}
          <div>
            <div className="mb-3 h-4 w-24 bg-void-muted skeleton" />
            <div className="grid grid-cols-2 gap-px border border-void-border bg-void-border sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 bg-void-surface px-3 py-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-void-muted skeleton" />
                  <div className="h-3 w-28 bg-void-muted skeleton" />
                </div>
              ))}
            </div>
          </div>

          {/* Service rows */}
          <div className="border border-void-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-void-border bg-void-surface px-4 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-void-muted skeleton" />
                  <div className="h-4 w-32 bg-void-muted skeleton" />
                </div>
                <div className="h-3 w-16 bg-void-muted skeleton" />
              </div>
            ))}
          </div>
        </div>

        {/* Right pane */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="h-4 w-32 bg-void-muted skeleton" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-void-border bg-void-surface p-3 flex flex-col gap-2">
              <div className="h-4 w-20 bg-void-muted skeleton" />
              <div className="h-3 w-full bg-void-muted skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
