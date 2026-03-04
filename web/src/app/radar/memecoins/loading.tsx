/**
 * Memecoins page loading skeleton.
 */
export default function MemecoinsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-36 rounded-none bg-void-muted skeleton" />
        <div className="mt-2 h-4 w-80 rounded-none bg-void-muted skeleton" />
      </div>

      {/* Stats bar — 5 cards matching StatsBar grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-none border border-void-border bg-void-surface px-4 py-3"
          >
            <div className="h-3 w-20 rounded-none bg-void-muted skeleton" />
            <div className="mt-2 h-5 w-12 rounded-none bg-void-muted skeleton" />
          </div>
        ))}
      </div>

      {/* Two-column skeleton */}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="space-y-6 md:w-3/5">
          <section className="space-y-4">
            <div>
              <div className="h-5 w-36 rounded-none bg-void-muted skeleton" />
              <div className="mt-1 h-3 w-64 rounded-none bg-void-muted skeleton" />
            </div>
            <div className="overflow-x-auto rounded-none border border-void-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-t border-void-border px-3 py-2 first:border-t-0">
                  <div className="h-3 w-6 rounded-none bg-void-muted skeleton" />
                  <div className="h-4 w-20 rounded-none bg-void-muted skeleton" />
                  <div className="h-3 w-16 rounded-none bg-void-muted skeleton" />
                  <div className="h-3 w-20 rounded-none bg-void-muted skeleton" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="md:w-2/5">
          <div className="space-y-4 md:border-l md:border-void-border md:pl-6">
            <div className="h-5 w-32 rounded-none bg-void-muted skeleton" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-none border border-void-border bg-void-surface px-4 py-3">
                <div className="h-4 w-28 rounded-none bg-void-muted skeleton" />
                <div className="mt-2 h-3 w-full rounded-none bg-void-muted skeleton" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
