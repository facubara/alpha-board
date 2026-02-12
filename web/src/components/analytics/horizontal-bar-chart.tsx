"use client";

/**
 * HorizontalBarChart — Reusable horizontal bar chart.
 * Positive bars green (right), negative red (left). Pure SVG.
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

  const rowHeight = 28;
  const labelWidth = 120;
  const valueWidth = 80;
  const barAreaWidth = 400;
  const width = labelWidth + barAreaWidth + valueWidth;
  const height = items.length * rowHeight + 8;

  const maxAbs = Math.max(...items.map((d) => Math.abs(d.value)), 0.01);
  const midX = labelWidth + barAreaWidth / 2;

  // Build aria summary
  const summaryParts = items.map(
    (item) => `${item.label}: ${formatValue(item.value)}`
  );
  const ariaLabel = `Bar chart: ${summaryParts.join(", ")}`;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>

        {/* Center line */}
        <line
          x1={midX}
          y1={0}
          x2={midX}
          y2={height}
          stroke="var(--border-subtle)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        {items.map((item, i) => {
          const y = i * rowHeight + 4;
          const barWidth = (Math.abs(item.value) / maxAbs) * (barAreaWidth / 2 - 4);
          const isPositive = item.value >= 0;
          const barX = isPositive ? midX : midX - barWidth;
          const fillColor = isPositive
            ? "var(--bullish-strong)"
            : "var(--bearish-strong)";

          return (
            <g key={item.label}>
              {/* Label */}
              <text
                x={labelWidth - 8}
                y={y + rowHeight / 2 + 1}
                textAnchor="end"
                fill="var(--text-secondary)"
                fontSize="11"
                fontFamily="var(--font-geist-sans)"
              >
                {item.label}
              </text>
              {item.sublabel && (
                <text
                  x={labelWidth - 8}
                  y={y + rowHeight / 2 + 11}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  {item.sublabel}
                </text>
              )}

              {/* Bar */}
              <rect
                x={barX}
                y={y + 4}
                width={Math.max(barWidth, 1)}
                height={rowHeight - 10}
                rx="2"
                fill={fillColor}
                opacity="0.7"
              />

              {/* Value */}
              <text
                x={labelWidth + barAreaWidth + 4}
                y={y + rowHeight / 2 + 1}
                textAnchor="start"
                fill={isPositive ? "var(--bullish-strong)" : "var(--bearish-strong)"}
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {formatValue(item.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
