"use client";

/**
 * EquityChart — Line chart showing equity curve from trade history.
 * X-axis uses real trade timestamps (not trade index).
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
  ResponsiveContainer,
} from "recharts";
import type { AgentTrade } from "@/lib/types";
import {
  AXIS_TICK_STYLE,
  GRID_PROPS,
  TOOLTIP_STYLE,
  CHART_COLORS,
  formatUsd,
  formatTimestampTick,
} from "@/lib/chart-theme";

interface EquityChartProps {
  trades: AgentTrade[];
  initialBalance: number;
  className?: string;
}

export function EquityChart({
  trades,
  initialBalance,
  className,
}: EquityChartProps) {
  const chartData = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
    );

    const points: { ts: number; equity: number; symbol: string }[] = [];

    // Starting point
    if (sorted.length > 0) {
      points.push({
        ts: new Date(sorted[0].closedAt).getTime() - 1,
        equity: initialBalance,
        symbol: "Start",
      });
    }

    let equity = initialBalance;
    for (const trade of sorted) {
      equity += trade.pnl;
      points.push({
        ts: new Date(trade.closedAt).getTime(),
        equity,
        symbol: trade.symbol,
      });
    }

    return points;
  }, [trades, initialBalance]);

  if (chartData.length < 2) {
    return (
      <div
        className={`flex h-40 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">No trades yet</p>
      </div>
    );
  }

  const lastEquity = chartData[chartData.length - 1].equity;
  const color = lastEquity >= initialBalance ? CHART_COLORS.bullish : CHART_COLORS.bearish;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
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
            formatter={(value, _name, entry) => [
              formatUsd(Number(value)),
              (entry as { payload?: { symbol?: string } }).payload?.symbol ?? "Equity",
            ]}
          />
          <ReferenceLine
            y={initialBalance}
            stroke="var(--border-subtle)"
            strokeDasharray="4 4"
          />
          <Line
            type="linear"
            dataKey="equity"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
