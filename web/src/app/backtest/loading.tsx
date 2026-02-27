/**
 * Backtest page loading skeleton.
 */
export default function BacktestLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-28 rounded bg-[var(--bg-muted)] skeleton" />
        <div className="mt-2 h-4 w-72 rounded bg-[var(--bg-muted)] skeleton" />
      </div>

      {/* Form placeholder */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
              <div className="h-9 rounded-md bg-[var(--bg-muted)] skeleton" />
            </div>
          ))}
        </div>
        <div className="h-9 w-32 rounded-md bg-[var(--bg-muted)] skeleton" />
      </div>

      {/* Run cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-36 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="h-5 w-16 rounded-full bg-[var(--bg-muted)] skeleton" />
              </div>
              <div className="h-4 w-24 rounded bg-[var(--bg-muted)] skeleton" />
            </div>
            <div className="mt-3 flex gap-6">
              <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
              <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
              <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
