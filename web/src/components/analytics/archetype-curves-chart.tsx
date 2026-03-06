"use client";

/**
 * ArchetypeCurvesChart — Multi-line chart showing cumulative PnL per archetype.
 * Uses a muted monochromatic zinc palette to avoid rainbow "spaghetti chart" effect.
 * The hovered line gets highlighted via Recharts activeDot.
 */

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DailyArchetypePnl, StrategyArchetype } from "@/lib/types";
import {
  AXIS_TICK_STYLE,
  GRID_PROPS,
  TOOLTIP_STYLE,
  formatUsd,
  formatDateTick,
} from "@/lib/chart-theme";

// Monochromatic terminal palette — muted zinc/slate tones to avoid neon rainbow
const ARCHETYPE_COLORS: Partial<Record<StrategyArchetype, string>> = {
  momentum: "#FFB000",        // terminal-amber (primary)
  mean_reversion: "#A1A1AA",  // zinc-400
  breakout: "#D4D4D8",        // zinc-300
  swing: "#71717A",           // zinc-500
  tweet_momentum: "#E4C78A",  // warm muted amber
  tweet_contrarian: "#8B8B95", // muted slate
  tweet_narrative: "#9CA3AF",  // gray-400
  tweet_insider: "#52525B",   // zinc-600
  hybrid_momentum: "#D9A44D", // warm gold
  hybrid_mean_reversion: "#6B7280", // gray-500
  hybrid_breakout: "#B0A080", // muted sand
  hybrid_swing: "#4B5563",    // gray-600
};

const ARCHETYPE_LABELS: Partial<Record<StrategyArchetype, string>> = {
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  breakout: "Breakout",
  swing: "Swing",
  tweet_momentum: "TW Momentum",
  tweet_contrarian: "TW Contrarian",
  tweet_narrative: "TW Narrative",
  tweet_insider: "TW Insider",
  hybrid_momentum: "Hybrid Momentum",
  hybrid_mean_reversion: "Hybrid Mean Rev",
  hybrid_breakout: "Hybrid Breakout",
  hybrid_swing: "Hybrid Swing",
};

interface ArchetypeCurvesChartProps {
  data: DailyArchetypePnl[];
  className?: string;
}

export function ArchetypeCurvesChart({ data, className }: ArchetypeCurvesChartProps) {
  const { chartData, archetypes, allDays } = useMemo(() => {
    // Build cumulative curves per archetype
    const cumulatives: Record<string, number> = {};
    const lookup: Record<string, Record<string, number>> = {};
    for (const d of data) {
      if (!lookup[d.day]) lookup[d.day] = {};
      lookup[d.day][d.archetype] = d.dailyPnl;
    }

    const days = [...new Set(data.map((d) => d.day))].sort();
    const archs = [...new Set(data.map((d) => d.archetype))] as StrategyArchetype[];

    for (const arch of archs) cumulatives[arch] = 0;

    // Pivot: one row per day with a key per archetype
    const rows = days.map((day) => {
      const row: Record<string, string | number> = { day };
      for (const arch of archs) {
        cumulatives[arch] += lookup[day]?.[arch] ?? 0;
        row[arch] = cumulatives[arch];
      }
      return row;
    });

    return { chartData: rows, archetypes: archs, allDays: days };
  }, [data]);

  if (allDays.length < 2) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-none border border-void-border bg-void-surface ${className ?? ""}`}
      >
        <p className="font-mono text-xs text-text-tertiary">Not enough data for chart</p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-none border border-void-border bg-void-surface ${className ?? ""}`}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDateTick}
            tick={AXIS_TICK_STYLE}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={formatUsd}
            tick={AXIS_TICK_STYLE}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE.contentStyle}
            cursor={TOOLTIP_STYLE.cursor}
            itemStyle={TOOLTIP_STYLE.itemStyle}
            labelStyle={TOOLTIP_STYLE.labelStyle}
            labelFormatter={(label) => formatDateTick(String(label))}
            formatter={(value, name) => [
              formatUsd(Number(value)),
              ARCHETYPE_LABELS[String(name) as StrategyArchetype] ?? name,
            ]}
          />
          <ReferenceLine y={0} stroke="#27272A" strokeDasharray="4 4" />
          <Legend
            iconType="plainline"
            iconSize={10}
            wrapperStyle={{ fontSize: 10, paddingTop: 4, fontFamily: "var(--font-geist-mono), monospace" }}
            formatter={(value: string) =>
              ARCHETYPE_LABELS[value as StrategyArchetype] ?? value
            }
          />
          {archetypes.map((arch) => (
            <Line
              key={arch}
              type="linear"
              dataKey={arch}
              stroke={ARCHETYPE_COLORS[arch] ?? "#52525B"}
              strokeWidth={1.2}
              dot={false}
              activeDot={{ r: 4, stroke: "#FFB000", strokeWidth: 2, fill: "#FFB000" }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
