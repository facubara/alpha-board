/**
 * Status page loading skeleton.
 */
export default function StatusLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-40 rounded bg-[var(--bg-muted)] skeleton" />
        <div className="mt-2 h-4 w-80 rounded bg-[var(--bg-muted)] skeleton" />
      </div>

      {/* Status banner */}
      <div className="h-12 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] skeleton" />

      {/* Service rows */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-[var(--bg-muted)] skeleton" />
              <div className="h-4 w-32 rounded bg-[var(--bg-muted)] skeleton" />
            </div>
            <div className="flex items-center gap-6">
              <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
              <div className="h-6 w-48 rounded bg-[var(--bg-muted)] skeleton" />
            </div>
          </div>
        ))}
      </div>

      {/* LLM settings section */}
      <div className="space-y-3">
        <div className="h-5 w-28 rounded bg-[var(--bg-muted)] skeleton" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] skeleton"
          />
        ))}
      </div>
    </div>
  );
}
