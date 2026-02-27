/**
 * Memecoins page loading skeleton.
 */
export default function MemecoinsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-36 rounded bg-[var(--bg-muted)] skeleton" />
        <div className="mt-2 h-4 w-80 rounded bg-[var(--bg-muted)] skeleton" />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
          >
            <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="mt-2 h-5 w-12 rounded bg-[var(--bg-muted)] skeleton" />
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Left column */}
        <div className="space-y-6 md:w-3/5">
          {/* Trending tokens */}
          <section className="space-y-4">
            <div className="h-5 w-36 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-12 items-center gap-4 border-t border-[var(--border-subtle)] px-4 first:border-t-0"
                >
                  <div className="h-3 w-6 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-4 w-20 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-24 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
                </div>
              ))}
            </div>
          </section>

          {/* Watch wallets */}
          <section className="space-y-4">
            <div className="h-5 w-32 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 w-24 rounded-md bg-[var(--bg-muted)] skeleton" />
              ))}
            </div>
            <div className="h-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] skeleton" />
          </section>
        </div>

        {/* Right column — tweet feed */}
        <div className="md:w-2/5">
          <div className="space-y-4 md:border-l md:border-[var(--border-default)] md:pl-6">
            <div className="h-5 w-40 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[var(--bg-muted)] skeleton" />
                    <div className="h-3 w-24 rounded bg-[var(--bg-muted)] skeleton" />
                  </div>
                  <div className="mt-2 h-3 w-full rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="mt-1 h-3 w-2/3 rounded bg-[var(--bg-muted)] skeleton" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
