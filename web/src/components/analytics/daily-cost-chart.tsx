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

/** Deduplicate date labels for sparse data. */
function buildDateLabels(
  days: string[],
  scaleX: (i: number) => number,
  targetCount: number
): { x: number; label: string }[] {
  const uniqueDays = [...new Set(days)];
  const count = Math.min(targetCount, uniqueDays.length);
  if (count <= 0) return [];

  const labels: { x: number; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const dayIdx = Math.round((i / (count - 1)) * (uniqueDays.length - 1));
    const day = uniqueDays[dayIdx];
    const dataIdx = days.indexOf(day);
    if (dataIdx >= 0) {
      labels.push({
        x: scaleX(dataIdx),
        label: new Date(day + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      });
    }
  }
  return labels;
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
  const chartFloor = height - padY;

  const scaleX = (x: number) => padX + (x / maxX) * (width - padX * 2);
  const scaleY = (y: number) =>
    height - padY - ((y - minY) / rangeY) * (height - padY * 2);

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(d.dailyCost)}`)
    .join(" ");

  // Area fill to chart floor
  const areaD = `${pathD} L ${scaleX(maxX)} ${chartFloor} L ${scaleX(0)} ${chartFloor} Z`;

  const strokeColor = "#F59E0B";

  const dateLabels = buildDateLabels(
    data.map((d) => d.day),
    scaleX,
    4
  );

  const totalCost = values.reduce((sum, v) => sum + v, 0);
  const ariaLabel = `Daily token cost chart: $${totalCost.toFixed(2)} total over ${data.length} days`;

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
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>

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
