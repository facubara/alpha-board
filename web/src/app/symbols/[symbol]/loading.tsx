export default function SymbolLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-7 w-32 rounded bg-[var(--bg-muted)]" />
        <div className="h-4 w-4 rounded bg-[var(--bg-muted)]" />
      </div>

      {/* Timeframe selector skeleton */}
      <div className="flex gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-10 rounded bg-[var(--bg-muted)]" />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-[600px] rounded-lg border border-[var(--border-default)] bg-[#0B0E11]" />

      {/* Legend skeleton */}
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
        ))}
      </div>
    </div>
  );
}
