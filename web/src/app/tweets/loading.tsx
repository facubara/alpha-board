/**
 * Tweets page loading skeleton.
 */
export default function TweetsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-36 rounded bg-[var(--bg-muted)] skeleton" />
        <div className="mt-2 h-4 w-72 rounded bg-[var(--bg-muted)] skeleton" />
      </div>

      {/* Signal stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
          >
            <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="mt-2 h-5 w-12 rounded bg-[var(--bg-muted)] skeleton" />
          </div>
        ))}
      </div>

      {/* Account cards */}
      <div className="space-y-3">
        <div className="h-5 w-40 rounded bg-[var(--bg-muted)] skeleton" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 w-48 shrink-0 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] skeleton"
            />
          ))}
        </div>
      </div>

      {/* Tweet feed */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[var(--bg-muted)] skeleton" />
              <div className="h-4 w-28 rounded bg-[var(--bg-muted)] skeleton" />
              <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full rounded bg-[var(--bg-muted)] skeleton" />
              <div className="h-3 w-3/4 rounded bg-[var(--bg-muted)] skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
