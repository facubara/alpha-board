"use client";

/**
 * ArchetypeCurvesChart — Multi-line SVG showing cumulative PnL per archetype.
 * SVG geometry + HTML text overlays + HTML legend.
 */

import { useMemo } from "react";
import type { DailyArchetypePnl, StrategyArchetype } from "@/lib/types";
import { getYAxisLabelVisibility } from "@/lib/chart-utils";

const ARCHETYPE_COLORS: Partial<Record<StrategyArchetype, string>> = {
  momentum: "#3B82F6",
  mean_reversion: "#A855F7",
  breakout: "#F59E0B",
  swing: "#06B6D4",
  tweet_momentum: "#2DD4BF",
  tweet_mean_reversion: "#5EEAD4",
  tweet_breakout: "#14B8A6",
  tweet_swing: "#0D9488",
  hybrid_momentum: "#C084FC",
  hybrid_mean_reversion: "#A78BFA",
  hybrid_breakout: "#8B5CF6",
  hybrid_swing: "#7C3AED",
};

const ARCHETYPE_LABELS: Partial<Record<StrategyArchetype, string>> = {
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  breakout: "Breakout",
  swing: "Swing",
  tweet_momentum: "Tweet Momentum",
  tweet_mean_reversion: "Tweet Mean Rev",
  tweet_breakout: "Tweet Breakout",
  tweet_swing: "Tweet Swing",
  hybrid_momentum: "Hybrid Momentum",
  hybrid_mean_reversion: "Hybrid Mean Rev",
  hybrid_breakout: "Hybrid Breakout",
  hybrid_swing: "Hybrid Swing",
};

interface ArchetypeCurvesChartProps {
  data: DailyArchetypePnl[];
  className?: string;
}

/** Deduplicate date labels for sparse data. */
function buildDateLabels(
  allDays: string[],
  scaleX: (i: number) => number,
  targetCount: number
): { x: number; label: string }[] {
  const uniqueDays = [...new Set(allDays)];
  const count = Math.min(targetCount, uniqueDays.length);
  if (count <= 0) return [];

  const labels: { x: number; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const dayIdx = Math.round((i / (count - 1)) * (uniqueDays.length - 1));
    const day = uniqueDays[dayIdx];
    const dataIdx = allDays.indexOf(day);
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

export function ArchetypeCurvesChart({ data, className }: ArchetypeCurvesChartProps) {
  const curves = useMemo(() => {
    const byArchetype: Record<string, { day: string; cumPnl: number }[]> = {};
    const cumulatives: Record<string, number> = {};
    const allDays = [...new Set(data.map((d) => d.day))].sort();
    const lookup: Record<string, Record<string, number>> = {};
    for (const d of data) {
      if (!lookup[d.day]) lookup[d.day] = {};
      lookup[d.day][d.archetype] = d.dailyPnl;
    }
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
  const maxLabelY = scaleY(maxY);
  const minLabelY = scaleY(minY);

  const { showBaseline, showMax, showMin } = getYAxisLabelVisibility(
    baselineY, maxLabelY, minLabelY
  );

  const dateLabels = buildDateLabels(curves.allDays, scaleX, 4);

  // Build aria description
  const summaryParts = curves.archetypes.map((arch) => {
    const pts = curves.byArchetype[arch] ?? [];
    const final = pts.length > 0 ? pts[pts.length - 1].cumPnl : 0;
    return `${ARCHETYPE_LABELS[arch]}: ${final >= 0 ? "+" : ""}$${final.toFixed(0)}`;
  });
  const ariaLabel = `Cumulative PnL by archetype: ${summaryParts.join(", ")}`;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>

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
            $0
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
            ${maxY.toFixed(0)}
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
            ${minY.toFixed(0)}
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

      {/* Legend as HTML flex row */}
      <div className="flex flex-wrap gap-4 px-3 pb-2 pt-1">
        {curves.archetypes.map((arch) => (
          <div key={arch} className="flex items-center gap-1.5">
            <div
              className="h-[3px] w-[10px] rounded-sm"
              style={{ backgroundColor: ARCHETYPE_COLORS[arch] ?? "#888" }}
            />
            <span className="text-[10px] text-secondary">
              {ARCHETYPE_LABELS[arch] ?? arch}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
