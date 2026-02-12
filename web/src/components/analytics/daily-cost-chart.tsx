"use client";

/**
 * DailyCostChart — Area line chart showing daily token costs.
 * Amber/neutral color scheme.
 */

import type { DailyTokenCost } from "@/lib/types";

interface DailyCostChartProps {
  data: DailyTokenCost[];
  className?: string;
}

export function DailyCostChart({ data, className }: DailyCostChartProps) {
  if (data.length < 2) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">Not enough cost data</p>
      </div>
    );
  }

  const width = 700;
  const height = 200;
  const padX = 55;
  const padY = 20;

  const values = data.map((d) => d.dailyCost);
  const minY = 0;
  const maxY = Math.max(...values, 0.01);
  const rangeY = maxY - minY || 1;
  const maxX = data.length - 1;

  const scaleX = (x: number) => padX + (x / maxX) * (width - padX * 2);
  const scaleY = (y: number) =>
    height - padY - ((y - minY) / rangeY) * (height - padY * 2);

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(d.dailyCost)}`)
    .join(" ");

  const areaD = `${pathD} L ${scaleX(maxX)} ${scaleY(0)} L ${scaleX(0)} ${scaleY(0)} Z`;

  const strokeColor = "#F59E0B";

  // Date labels
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

  // Cumulative total
  const totalCost = values.reduce((sum, v) => sum + v, 0);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <p className="text-xs text-muted">Daily Token Cost (90d)</p>
        <p className="font-mono text-xs text-secondary">
          Total: ${totalCost.toFixed(2)}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        {/* Area fill */}
        <path d={areaD} fill={strokeColor} opacity="0.08" />

        {/* Y-axis labels */}
        <text
          x={padX - 4}
          y={scaleY(maxY) + 3}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          ${maxY.toFixed(2)}
        </text>
        <text
          x={padX - 4}
          y={scaleY(0) + 3}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          $0
        </text>

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

        {/* Cost line */}
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
          cy={scaleY(data[data.length - 1].dailyCost)}
          r="3"
          fill={strokeColor}
        />
      </svg>
    </div>
  );
}
