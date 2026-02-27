"use client";

/**
 * ComparisonEquityChart — Multi-line chart for comparing agent equity curves.
 * Cross-agent timestamp merge, HTML legend preserved.
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
import type { AgentDetail, AgentTrade } from "@/lib/types";
import {
  AXIS_TICK_STYLE,
  GRID_PROPS,
  TOOLTIP_STYLE,
  formatUsd,
  formatTimestampTick,
} from "@/lib/chart-theme";

interface ComparisonEquityChartProps {
  agents: AgentDetail[];
  trades: Record<number, AgentTrade[]>;
  colorMap: Record<number, string>;
  className?: string;
}

export function ComparisonEquityChart({
  agents,
  trades,
  colorMap,
  className,
}: ComparisonEquityChartProps) {
  const { chartData, agentKeys, finalEquities } = useMemo(() => {
    // Build per-agent equity curves keyed by timestamp
    const curves: Record<number, { date: number; equity: number }[]> = {};
    const finals: Record<number, number> = {};

    for (const agent of agents) {
      const agentTrades = trades[agent.id] ?? [];
      const sorted = [...agentTrades].sort(
        (a, b) =>
          new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
      );

      const points: { date: number; equity: number }[] = [];
      let equity = agent.initialBalance;

      const firstDate =
        sorted.length > 0
          ? new Date(sorted[0].closedAt).getTime() - 1
          : new Date(agent.createdAt).getTime();
      points.push({ date: firstDate, equity });

      for (const trade of sorted) {
        equity += trade.pnl;
        points.push({ date: new Date(trade.closedAt).getTime(), equity });
      }

      curves[agent.id] = points;
      finals[agent.id] = equity;
    }

    // Merge all timestamps into a single sorted list and build chart rows
    const allTimestamps = new Set<number>();
    for (const pts of Object.values(curves)) {
      for (const p of pts) allTimestamps.add(p.date);
    }
    const sortedTs = [...allTimestamps].sort((a, b) => a - b);

    const keys = agents.map((a) => `agent_${a.id}`);

    const rows = sortedTs.map((ts) => {
      const row: Record<string, number> = { ts };
      for (const agent of agents) {
        const pts = curves[agent.id];
        // Find the last point at or before this timestamp
        let val: number | undefined;
        for (let i = pts.length - 1; i >= 0; i--) {
          if (pts[i].date <= ts) {
            val = pts[i].equity;
            break;
          }
        }
        if (val !== undefined) {
          row[`agent_${agent.id}`] = val;
        }
      }
      return row;
    });

    return { chartData: rows, agentKeys: keys, finalEquities: finals };
  }, [agents, trades]);

  // Check if there's enough data
  const totalPoints = Object.values(trades).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  if (totalPoints < 2) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">Not enough trades to compare</p>
      </div>
    );
  }

  // Agent name lookup for tooltip
  const agentNameMap: Record<string, string> = {};
  for (const agent of agents) {
    agentNameMap[`agent_${agent.id}`] = agent.displayName;
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <ResponsiveContainer width="100%" height={240}>
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
            formatter={(value, name) => [
              formatUsd(Number(value)),
              agentNameMap[String(name)] ?? name,
            ]}
          />
          <ReferenceLine y={10000} stroke="var(--border-subtle)" strokeDasharray="4 4" />
          {agentKeys.map((key) => {
            const agentId = parseInt(key.replace("agent_", ""));
            return (
              <Line
                key={key}
                type="linear"
                dataKey={key}
                stroke={colorMap[agentId] ?? "#888"}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend as HTML flex row */}
      <div className="flex flex-wrap gap-4 px-3 pb-2 pt-1">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-1.5">
            <div
              className="h-[3px] w-[10px] rounded-sm"
              style={{ backgroundColor: colorMap[agent.id] ?? "#888" }}
            />
            <span className="text-xs text-secondary">
              {agent.displayName} (${(finalEquities[agent.id] ?? agent.initialBalance).toFixed(0)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
