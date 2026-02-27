"use client";

/**
 * BacktestEquityChart — Area line chart showing equity curve from backtest data.
 * Uses real timestamps on the X-axis.
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
import {
  AXIS_TICK_STYLE,
  GRID_PROPS,
  TOOLTIP_STYLE,
  CHART_COLORS,
  formatUsd,
  formatTimestampTick,
} from "@/lib/chart-theme";

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
  const chartData = useMemo(() => {
    // Downsample if too many points (keep ~200 for smooth rendering)
    const MAX_POINTS = 200;
    const step = Math.max(1, Math.floor(equityCurve.length / MAX_POINTS));
    const points =
      equityCurve.length > MAX_POINTS
        ? equityCurve.filter((_, i) => i % step === 0 || i === equityCurve.length - 1)
        : equityCurve;

    return points.map((p) => ({
      ts: new Date(p.timestamp).getTime(),
      equity: p.equity,
    }));
  }, [equityCurve]);

  if (equityCurve.length < 2) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">Insufficient data for chart</p>
      </div>
    );
  }

  const lastEquity = chartData[chartData.length - 1].equity;
  const isProfit = lastEquity >= initialBalance;
  const color = isProfit ? CHART_COLORS.bullish : CHART_COLORS.bearish;
  const gradientId = "btEquityGrad";

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
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTimestampTick}
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
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE.contentStyle}
            cursor={TOOLTIP_STYLE.cursor}
            itemStyle={TOOLTIP_STYLE.itemStyle}
            labelStyle={TOOLTIP_STYLE.labelStyle}
            labelFormatter={(label) =>
              new Date(Number(label)).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            formatter={(value) => [formatUsd(Number(value)), "Equity"]}
          />
          <ReferenceLine
            y={initialBalance}
            stroke="var(--border-subtle)"
            strokeDasharray="4 4"
          />
          <Area
            type="linear"
            dataKey="equity"
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
