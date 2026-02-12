"use client";

/**
 * BacktestEquityChart Component
 *
 * SVG line chart showing equity curve from backtest equity_curve data.
 * Adapted from agents/equity-chart.tsx.
 */

interface EquityPoint {
  timestamp: string;
  equity: number;
}

interface BacktestEquityChartProps {
  equityCurve: EquityPoint[];
  initialBalance: number;
  className?: string;
}

export function BacktestEquityChart({
  equityCurve,
  initialBalance,
  className,
}: BacktestEquityChartProps) {
  if (equityCurve.length < 2) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">Insufficient data for chart</p>
      </div>
    );
  }

  // Downsample if too many points (keep ~200 for smooth rendering)
  const MAX_POINTS = 200;
  const step = Math.max(1, Math.floor(equityCurve.length / MAX_POINTS));
  const points =
    equityCurve.length > MAX_POINTS
      ? equityCurve.filter((_, i) => i % step === 0 || i === equityCurve.length - 1)
      : equityCurve;

  const width = 700;
  const height = 200;
  const padX = 55;
  const padY = 20;

  const values = points.map((p) => p.equity);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const rangeY = maxY - minY || 1;
  const maxX = points.length - 1;

  const scaleX = (x: number) => padX + (x / maxX) * (width - padX * 2);
  const scaleY = (y: number) =>
    height - padY - ((y - minY) / rangeY) * (height - padY * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(p.equity)}`)
    .join(" ");

  // Area fill under the line
  const areaD = `${pathD} L ${scaleX(maxX)} ${height - padY} L ${scaleX(0)} ${height - padY} Z`;

  const lastEquity = points[points.length - 1].equity;
  const isProfit = lastEquity >= initialBalance;
  const strokeColor = isProfit
    ? "var(--bullish-strong)"
    : "var(--bearish-strong)";
  const fillColor = isProfit
    ? "var(--bullish-strong)"
    : "var(--bearish-strong)";

  const baselineY = scaleY(initialBalance);

  // X-axis date labels (show ~4 dates)
  const dateLabels: { x: number; label: string }[] = [];
  const labelCount = 4;
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * maxX);
    const point = points[idx];
    if (point) {
      dateLabels.push({
        x: scaleX(idx),
        label: new Date(point.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      });
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        {/* Area fill */}
        <path d={areaD} fill={fillColor} opacity="0.05" />

        {/* Baseline at initial balance */}
        <line
          x1={padX}
          y1={baselineY}
          x2={width - padX}
          y2={baselineY}
          stroke="var(--border-subtle)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Baseline label */}
        <text
          x={padX - 4}
          y={baselineY + 3}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          {initialBalance.toLocaleString()}
        </text>

        {/* Min/Max labels */}
        <text
          x={padX - 4}
          y={scaleY(maxY) + 3}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          {maxY.toFixed(0)}
        </text>
        {Math.abs(scaleY(minY) - scaleY(maxY)) > 20 && (
          <text
            x={padX - 4}
            y={scaleY(minY) + 3}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            {minY.toFixed(0)}
          </text>
        )}

        {/* X-axis date labels */}
        {dateLabels.map((d, i) => (
          <text
            key={i}
            x={d.x}
            y={height - 4}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            {d.label}
          </text>
        ))}

        {/* Equity line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point */}
        <circle
          cx={scaleX(maxX)}
          cy={scaleY(lastEquity)}
          r="3"
          fill={strokeColor}
        />
      </svg>
    </div>
  );
}
