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
        className={`flex h-20 items-center justify-center rounded-none border border-void-border bg-void-surface ${className ?? ""}`}
      >
        <p className="text-xs text-text-tertiary">No data</p>
      </div>
    );
  }

  const maxAbs = Math.max(...items.map((d) => Math.abs(d.value)), 0.01);
  const allPositive = items.every((i) => i.value >= 0);
  const allNegative = items.every((i) => i.value < 0);
  const allSameSign = allPositive || allNegative;

  // Build aria summary
  const summaryParts = items.map(
    (item) => `${item.label}: ${formatValue(item.value)}`
  );
  const ariaLabel = `Bar chart: ${summaryParts.join(", ")}`;

  return (
    <div
      className={`overflow-hidden rounded-none border border-void-border bg-void-surface ${className ?? ""}`}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="divide-y divide-void-border">
        {items.map((item) => {
          const pct = (Math.abs(item.value) / maxAbs) * 100;
          const isPositive = item.value >= 0;

          return (
            <div
              key={item.label}
              className="flex items-center gap-2 px-3 py-2"
            >
              {/* Label column */}
              <div className="w-28 shrink-0 text-right sm:w-36">
                <p className="truncate text-xs text-text-secondary">{item.label}</p>
                {item.sublabel && (
                  <p className="truncate font-mono text-xs text-text-tertiary">
                    {item.sublabel}
                  </p>
                )}
              </div>

              {/* Bar area */}
              {allSameSign ? (
                <div
                  className={`flex h-4 min-w-0 flex-1 ${allNegative ? "justify-end" : ""}`}
                >
                  <div
                    className={`${
                      isPositive
                        ? "rounded-r-sm bg-[#10B981]"
                        : "rounded-l-sm bg-[#F43F5E]"
                    }`}
                    style={{ width: `${pct}%`, opacity: 0.7 }}
                  />
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center">
                  {/* Negative half */}
                  <div className="flex h-4 flex-1 justify-end">
                    {!isPositive && (
                      <div
                        className="rounded-l-sm bg-[#F43F5E]"
                        style={{ width: `${pct}%`, opacity: 0.7 }}
                      />
                    )}
                  </div>

                  {/* Center divider */}
                  <div className="mx-px h-5 w-px shrink-0 bg-void-border" />

                  {/* Positive half */}
                  <div className="flex h-4 flex-1">
                    {isPositive && (
                      <div
                        className="rounded-r-sm bg-[#10B981]"
                        style={{ width: `${pct}%`, opacity: 0.7 }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Value column */}
              <div className="w-20 shrink-0 text-right sm:w-24">
                <span
                  className={`font-mono text-xs ${
                    isPositive
                      ? "text-[#10B981]"
                      : "text-[#F43F5E]"
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
