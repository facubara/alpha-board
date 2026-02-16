"use client";

/**
 * BacktestEquityChart Component
 *
 * SVG line chart showing equity curve from backtest equity_curve data.
 * SVG geometry + HTML text overlays for crisp labels.
 */

import { getYAxisLabelVisibility } from "@/lib/chart-utils";

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
  const maxLabelY = scaleY(maxY);
  const minLabelY = scaleY(minY);

  const { showBaseline, showMax, showMin } = getYAxisLabelVisibility(
    baselineY, maxLabelY, minLabelY
  );

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
      <div className="relative">
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

        {/* Y-axis labels as HTML overlays */}
        {showBaseline && (
          <span
            className="pointer-events-none absolute font-mono text-[9px] text-muted"
            style={{
              left: 0,
              width: `${(padX / width) * 100}%`,
              top: `${(baselineY / height) * 100}%`,
              transform: "translateY(-50%)",
              textAlign: "right",
              paddingRight: 4,
            }}
          >
            {initialBalance.toLocaleString()}
          </span>
        )}
        {showMax && (
          <span
            className="pointer-events-none absolute font-mono text-[9px] text-muted"
            style={{
              left: 0,
              width: `${(padX / width) * 100}%`,
              top: `${(maxLabelY / height) * 100}%`,
              transform: "translateY(-50%)",
              textAlign: "right",
              paddingRight: 4,
            }}
          >
            {maxY.toFixed(0)}
          </span>
        )}
        {showMin && (
          <span
            className="pointer-events-none absolute font-mono text-[9px] text-muted"
            style={{
              left: 0,
              width: `${(padX / width) * 100}%`,
              top: `${(minLabelY / height) * 100}%`,
              transform: "translateY(-50%)",
              textAlign: "right",
              paddingRight: 4,
            }}
          >
            {minY.toFixed(0)}
          </span>
        )}

        {/* Date labels as HTML overlays */}
        {dateLabels.map((d, i) => (
          <span
            key={i}
            className="pointer-events-none absolute font-mono text-[9px] text-muted"
            style={{
              left: `${(d.x / width) * 100}%`,
              bottom: 0,
              transform: "translateX(-50%)",
              paddingBottom: 2,
            }}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
