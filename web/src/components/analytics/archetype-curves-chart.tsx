"use client";

/**
 * ArchetypeCurvesChart — Multi-line chart showing cumulative PnL per archetype.
 * Data is pivoted from per-archetype arrays to per-day objects for Recharts.
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

const ARCHETYPE_COLORS: Partial<Record<StrategyArchetype, string>> = {
  momentum: "#3B82F6",
  mean_reversion: "#A855F7",
  breakout: "#F59E0B",
  swing: "#06B6D4",
  tweet_momentum: "#2DD4BF",
  tweet_contrarian: "#5EEAD4",
  tweet_narrative: "#14B8A6",
  tweet_insider: "#0D9488",
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
        className={`flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">Not enough data for chart</p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
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
          <ReferenceLine y={0} stroke="var(--border-subtle)" strokeDasharray="4 4" />
          <Legend
            iconType="plainline"
            iconSize={10}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            formatter={(value: string) =>
              ARCHETYPE_LABELS[value as StrategyArchetype] ?? value
            }
          />
          {archetypes.map((arch) => (
            <Line
              key={arch}
              type="monotone"
              dataKey={arch}
              stroke={ARCHETYPE_COLORS[arch] ?? "#888"}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
