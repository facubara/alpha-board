"use client";

/**
 * HorizontalBarChart — Reusable horizontal bar chart.
 * Positive bars green (right), negative red (left).
 * HTML/CSS layout for proper mobile text scaling.
 */

interface BarItem {
  label: string;
  value: number;
  sublabel?: string;
}

interface HorizontalBarChartProps {
  items: BarItem[];
  formatValue?: (v: number) => string;
  className?: string;
}

export function HorizontalBarChart({
  items,
  formatValue = (v) => `$${v.toFixed(2)}`,
  className,
}: HorizontalBarChartProps) {
  if (items.length === 0) {
    return (
      <div
        className={`flex h-20 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">No data</p>
      </div>
    );
  }

  const maxAbs = Math.max(...items.map((d) => Math.abs(d.value)), 0.01);

  // Build aria summary
  const summaryParts = items.map(
    (item) => `${item.label}: ${formatValue(item.value)}`
  );
  const ariaLabel = `Bar chart: ${summaryParts.join(", ")}`;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="divide-y divide-[var(--border-subtle)]">
        {items.map((item) => {
          const pct = (Math.abs(item.value) / maxAbs) * 100;
          const isPositive = item.value >= 0;

          return (
            <div
              key={item.label}
              className="flex items-center gap-2 px-3 py-2"
            >
              {/* Label column */}
              <div className="w-24 shrink-0 text-right sm:w-28">
                <p className="truncate text-xs text-secondary">{item.label}</p>
                {item.sublabel && (
                  <p className="truncate font-mono text-[10px] text-muted">
                    {item.sublabel}
                  </p>
                )}
              </div>

              {/* Bar area — two halves */}
              <div className="flex min-w-0 flex-1 items-center">
                {/* Negative half */}
                <div className="flex h-4 flex-1 justify-end">
                  {!isPositive && (
                    <div
                      className="rounded-l-sm bg-[var(--bearish-strong)]"
                      style={{
                        width: `${pct}%`,
                        opacity: 0.7,
                      }}
                    />
                  )}
                </div>

                {/* Center divider */}
                <div className="mx-px h-5 w-px shrink-0 bg-[var(--border-subtle)]" />

                {/* Positive half */}
                <div className="flex h-4 flex-1">
                  {isPositive && (
                    <div
                      className="rounded-r-sm bg-[var(--bullish-strong)]"
                      style={{
                        width: `${pct}%`,
                        opacity: 0.7,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Value column */}
              <div className="w-16 shrink-0 text-right sm:w-20">
                <span
                  className={`font-mono text-xs ${
                    isPositive
                      ? "text-[var(--bullish-strong)]"
                      : "text-[var(--bearish-strong)]"
                  }`}
                >
                  {formatValue(item.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
