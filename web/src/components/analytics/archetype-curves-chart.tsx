"use client";

/**
 * ArchetypeCurvesChart — Multi-line SVG showing cumulative PnL per archetype.
 */

import { useMemo } from "react";
import type { DailyArchetypePnl, StrategyArchetype } from "@/lib/types";

const ARCHETYPE_COLORS: Record<StrategyArchetype, string> = {
  momentum: "#3B82F6",
  mean_reversion: "#A855F7",
  breakout: "#F59E0B",
  swing: "#06B6D4",
};

const ARCHETYPE_LABELS: Record<StrategyArchetype, string> = {
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  breakout: "Breakout",
  swing: "Swing",
};

interface ArchetypeCurvesChartProps {
  data: DailyArchetypePnl[];
  className?: string;
}

export function ArchetypeCurvesChart({ data, className }: ArchetypeCurvesChartProps) {
  const curves = useMemo(() => {
    // Group by archetype, compute cumulative PnL
    const byArchetype: Record<string, { day: string; cumPnl: number }[]> = {};
    const cumulatives: Record<string, number> = {};

    // Get all unique days sorted
    const allDays = [...new Set(data.map((d) => d.day))].sort();

    // Build day->archetype->pnl lookup
    const lookup: Record<string, Record<string, number>> = {};
    for (const d of data) {
      if (!lookup[d.day]) lookup[d.day] = {};
      lookup[d.day][d.archetype] = d.dailyPnl;
    }

    // Get all archetypes present
    const archetypes = [...new Set(data.map((d) => d.archetype))] as StrategyArchetype[];

    for (const arch of archetypes) {
      cumulatives[arch] = 0;
      byArchetype[arch] = [];
    }

    for (const day of allDays) {
      for (const arch of archetypes) {
        cumulatives[arch] += lookup[day]?.[arch] ?? 0;
        byArchetype[arch].push({ day, cumPnl: cumulatives[arch] });
      }
    }

    return { byArchetype, archetypes, allDays };
  }, [data]);

  if (curves.allDays.length < 2) {
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
  const legendHeight = 24;
  const totalHeight = height + legendHeight;

  // Find global min/max across all curves
  const allValues = curves.archetypes.flatMap(
    (a) => curves.byArchetype[a]?.map((p) => p.cumPnl) ?? []
  );
  const minY = Math.min(0, ...allValues);
  const maxY = Math.max(0, ...allValues);
  const rangeY = maxY - minY || 1;
  const maxX = curves.allDays.length - 1;

  const scaleX = (x: number) => padX + (x / maxX) * (width - padX * 2);
  const scaleY = (y: number) =>
    height - padY - ((y - minY) / rangeY) * (height - padY * 2);

  const baselineY = scaleY(0);

  // Date labels
  const dateLabels: { x: number; label: string }[] = [];
  const labelCount = 4;
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * maxX);
    const day = curves.allDays[idx];
    if (day) {
      dateLabels.push({
        x: scaleX(idx),
        label: new Date(day + "T00:00:00").toLocaleDateString("en-US", {
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
      <svg viewBox={`0 0 ${width} ${totalHeight}`} className="w-full" preserveAspectRatio="none">
        {/* Baseline */}
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

        {/* Y-axis min/max */}
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

        {/* Lines per archetype */}
        {curves.archetypes.map((arch) => {
          const points = curves.byArchetype[arch] ?? [];
          const pathD = points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(p.cumPnl)}`)
            .join(" ");
          return (
            <path
              key={arch}
              d={pathD}
              fill="none"
              stroke={ARCHETYPE_COLORS[arch] ?? "#888"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Legend */}
        {curves.archetypes.map((arch, i) => {
          const legendX = padX + i * 140;
          const legendY = height + 14;
          return (
            <g key={`legend-${arch}`}>
              <rect
                x={legendX}
                y={legendY - 6}
                width="10"
                height="3"
                rx="1"
                fill={ARCHETYPE_COLORS[arch] ?? "#888"}
              />
              <text
                x={legendX + 14}
                y={legendY}
                fill="var(--text-secondary)"
                fontSize="10"
                fontFamily="var(--font-geist-sans)"
              >
                {ARCHETYPE_LABELS[arch] ?? arch}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
