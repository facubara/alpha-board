"use client";

/**
 * CumulativePnlChart — Area chart showing fleet-wide cumulative PnL.
 * Powered by Recharts with gridlines, tooltips, and proper axes.
 */

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { DailyPnl } from "@/lib/types";
import {
  AXIS_TICK_STYLE,
  GRID_PROPS,
  TOOLTIP_STYLE,
  CHART_COLORS,
  formatUsd,
  formatDateTick,
} from "@/lib/chart-theme";

interface CumulativePnlChartProps {
  data: DailyPnl[];
  className?: string;
}

export function CumulativePnlChart({ data, className }: CumulativePnlChartProps) {
  const chartData = useMemo(
    () => data.map((d) => ({ day: d.day, value: d.cumulativePnl })),
    [data]
  );

  if (data.length < 2) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">Not enough data for chart</p>
      </div>
    );
  }

  const finalPnl = data[data.length - 1].cumulativePnl;
  const color = finalPnl >= 0 ? CHART_COLORS.bullish : CHART_COLORS.bearish;
  const gradientId = "cumPnlGrad";

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.12} />
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
            formatter={(value) => [formatUsd(Number(value)), "Cumulative PnL"]}
          />
          <ReferenceLine y={0} stroke="var(--border-subtle)" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="value"
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
