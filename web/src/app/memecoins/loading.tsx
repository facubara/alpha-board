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

      {/* Stats bar — 5 cards matching StatsBar grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
          >
            <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="mt-2 h-5 w-12 rounded bg-[var(--bg-muted)] skeleton" />
          </div>
        ))}
      </div>

      {/* Two-column command center */}
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Left column (60%) */}
        <div className="space-y-6 md:w-3/5">
          {/* Trending Tokens section */}
          <section className="space-y-4">
            <div>
              <div className="h-5 w-36 rounded bg-[var(--bg-muted)] skeleton" />
              <div className="mt-1 h-3 w-64 rounded bg-[var(--bg-muted)] skeleton" />
            </div>

            {/* Add token bar */}
            <div className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
              <div className="h-4 w-4 rounded bg-[var(--bg-muted)] skeleton" />
              <div className="h-4 flex-1 rounded bg-[var(--bg-muted)] skeleton" />
              <div className="h-8 w-24 rounded-md bg-[var(--bg-muted)] skeleton" />
              <div className="h-8 w-16 rounded-md bg-[var(--bg-muted)] skeleton" />
            </div>

            {/* Token table */}
            <div className="overflow-x-auto rounded-md border border-[var(--border-default)]">
              {/* Table header */}
              <div className="flex items-center gap-3 bg-[var(--bg-surface)] px-3 py-2">
                <div className="h-3 w-6 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-14 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="hidden h-3 w-16 rounded bg-[var(--bg-muted)] skeleton md:block" />
                <div className="h-3 w-14 rounded bg-[var(--bg-muted)] skeleton" />
              </div>
              {/* Table rows */}
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-t border-[var(--border-default)] px-3 py-2"
                >
                  <div className="h-3 w-6 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-4 w-20 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-5 w-10 rounded-full bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-14 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="hidden h-3 w-16 rounded bg-[var(--bg-muted)] skeleton md:block" />
                  <div className="h-3 w-14 rounded bg-[var(--bg-muted)] skeleton" />
                </div>
              ))}
            </div>
          </section>

          {/* Watch Wallets section */}
          <section className="space-y-4">
            <div className="h-5 w-32 rounded bg-[var(--bg-muted)] skeleton" />

            {/* Tab bar */}
            <div className="flex gap-0 border-b border-[var(--border-default)]">
              <div className="h-9 w-20 rounded-none border-b-2 border-[var(--bg-muted)] bg-transparent px-4 py-2 skeleton" />
              <div className="h-9 w-20 rounded-none bg-transparent px-4 py-2 skeleton" />
            </div>

            {/* Search bar */}
            <div className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] sm:w-64 skeleton" />

            {/* Wallet table */}
            <div className="overflow-x-auto rounded-md border border-[var(--border-default)]">
              <div className="flex items-center gap-3 bg-[var(--bg-surface)] px-3 py-2">
                <div className="h-3 w-6 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-14 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-12 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-10 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-3 w-14 rounded bg-[var(--bg-muted)] skeleton" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-t border-[var(--border-default)] px-3 py-2"
                >
                  <div className="h-3 w-6 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-24 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-10 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-10 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-14 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-12 rounded bg-[var(--bg-muted)] skeleton" />
                </div>
              ))}
            </div>
          </section>

          {/* Tracked Accounts section */}
          <section className="space-y-4">
            <div className="h-5 w-40 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="h-9 w-52 rounded-md bg-[var(--bg-muted)] skeleton" />
          </section>
        </div>

        {/* Right column — tweet feed (40%) */}
        <div className="md:w-2/5">
          <div className="md:sticky md:top-[72px] md:max-h-[calc(100vh-72px-24px)] md:overflow-y-auto md:border-l md:border-[var(--border-default)] md:pl-6">
            <section className="space-y-4">
              {/* Header with filter buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-32 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-2 w-2 rounded-full bg-[var(--bg-muted)] skeleton" />
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-7 w-14 rounded-md bg-[var(--bg-muted)] skeleton" />
                  ))}
                </div>
              </div>

              {/* Tweet cards */}
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
                  >
                    {/* Author line */}
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-24 rounded bg-[var(--bg-muted)] skeleton" />
                      <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
                      <div className="h-4 w-14 rounded-full bg-[var(--bg-muted)] skeleton" />
                    </div>
                    {/* Tweet text */}
                    <div className="mt-2 space-y-1.5">
                      <div className="h-3 w-full rounded bg-[var(--bg-muted)] skeleton" />
                      <div className="h-3 w-4/5 rounded bg-[var(--bg-muted)] skeleton" />
                    </div>
                    {/* Metrics row */}
                    <div className="mt-2 flex items-center gap-4">
                      <div className="h-3 w-12 rounded bg-[var(--bg-muted)] skeleton" />
                      <div className="h-3 w-10 rounded bg-[var(--bg-muted)] skeleton" />
                      <div className="h-3 w-10 rounded bg-[var(--bg-muted)] skeleton" />
                    </div>
                    {/* AI analysis block */}
                    <div className="mt-2.5 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-16 rounded-full bg-[var(--bg-muted)] skeleton" />
                        <div className="h-4 w-20 rounded-full bg-[var(--bg-muted)] skeleton" />
                        <div className="h-3 w-10 rounded bg-[var(--bg-muted)] skeleton" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
