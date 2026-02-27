"use client";

/**
 * DailyCostChart — Area chart showing daily token costs.
 * Amber colour scheme, with total cost header.
 */

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyTokenCost } from "@/lib/types";
import {
  AXIS_TICK_STYLE,
  GRID_PROPS,
  TOOLTIP_STYLE,
  CHART_COLORS,
  formatDateTick,
} from "@/lib/chart-theme";

interface DailyCostChartProps {
  data: DailyTokenCost[];
  className?: string;
}

function formatCost(v: number): string {
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v > 0) return `$${v.toFixed(4)}`;
  return "$0";
}

export function DailyCostChart({ data, className }: DailyCostChartProps) {
  const chartData = useMemo(
    () => data.map((d) => ({ day: d.day, cost: d.dailyCost })),
    [data]
  );

  const totalCost = useMemo(
    () => data.reduce((sum, d) => sum + d.dailyCost, 0),
    [data]
  );

  if (data.length < 2) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">Not enough cost data</p>
      </div>
    );
  }

  const color = CHART_COLORS.amber;
  const gradientId = "costGrad";

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
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tickFormatter={formatCost}
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
            formatter={(value) => [formatCost(Number(value)), "Cost"]}
          />
          <Area
            type="linear"
            dataKey="cost"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
