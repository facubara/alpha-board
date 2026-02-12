"use client";

/**
 * CumulativePnlChart — Area line chart showing fleet-wide cumulative PnL.
 * Pure SVG, same pattern as backtest-equity-chart.tsx.
 */

import type { DailyPnl } from "@/lib/types";

interface CumulativePnlChartProps {
  data: DailyPnl[];
  className?: string;
}

export function CumulativePnlChart({ data, className }: CumulativePnlChartProps) {
  if (data.length < 2) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">Not enough data for chart</p>
      </div>
    );
  }

  const width = 700;
  const height = 200;
  const padX = 55;
  const padY = 20;

  const values = data.map((d) => d.cumulativePnl);
  const minY = Math.min(0, ...values);
  const maxY = Math.max(0, ...values);
  const rangeY = maxY - minY || 1;
  const maxX = data.length - 1;

  const scaleX = (x: number) => padX + (x / maxX) * (width - padX * 2);
  const scaleY = (y: number) =>
    height - padY - ((y - minY) / rangeY) * (height - padY * 2);

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(d.cumulativePnl)}`)
    .join(" ");

  const areaD = `${pathD} L ${scaleX(maxX)} ${scaleY(0)} L ${scaleX(0)} ${scaleY(0)} Z`;

  const finalPnl = data[data.length - 1].cumulativePnl;
  const isProfit = finalPnl >= 0;
  const strokeColor = isProfit ? "var(--bullish-strong)" : "var(--bearish-strong)";
  const fillColor = strokeColor;
  const baselineY = scaleY(0);

  // X-axis date labels (~4)
  const dateLabels: { x: number; label: string }[] = [];
  const labelCount = 4;
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * maxX);
    const point = data[idx];
    if (point) {
      dateLabels.push({
        x: scaleX(idx),
        label: new Date(point.day + "T00:00:00").toLocaleDateString("en-US", {
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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        {/* Area fill */}
        <path d={areaD} fill={fillColor} opacity="0.05" />

        {/* Baseline at $0 */}
        <line
          x1={padX}
          y1={baselineY}
          x2={width - padX}
          y2={baselineY}
          stroke="var(--border-subtle)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text
          x={padX - 4}
          y={baselineY + 3}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          $0
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
          ${maxY.toFixed(0)}
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
            ${minY.toFixed(0)}
          </text>
        )}

        {/* Date labels */}
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

        {/* PnL line */}
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
          cy={scaleY(finalPnl)}
          r="3"
          fill={strokeColor}
        />
      </svg>
    </div>
  );
}
