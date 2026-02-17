"use client";

/**
 * ComparisonMetrics — Side-by-side metric cards for agent comparison.
 * Best value highlighted with bold + green color.
 */

import type { AgentDetail } from "@/lib/types";

interface ComparisonMetricsProps {
  agents: AgentDetail[];
  colorMap: Record<number, string>;
}

interface Metric {
  label: string;
  getValue: (a: AgentDetail) => number;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

const METRICS: Metric[] = [
  {
    label: "Realized PnL",
    getValue: (a) => a.totalRealizedPnl,
    format: (v) => `${v >= 0 ? "+" : ""}$${v.toFixed(2)}`,
    higherIsBetter: true,
  },
  {
    label: "uPnL",
    getValue: (a) => a.unrealizedPnl,
    format: (v) => `${v >= 0 ? "+" : ""}$${v.toFixed(2)}`,
    higherIsBetter: true,
  },
  {
    label: "Return %",
    getValue: (a) => ((a.totalEquity - a.initialBalance) / a.initialBalance) * 100,
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
    higherIsBetter: true,
  },
  {
    label: "Win Rate",
    getValue: (a) => a.winRate,
    format: (v) => `${(v * 100).toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    label: "Trades",
    getValue: (a) => a.tradeCount,
    format: (v) => String(v),
    higherIsBetter: true,
  },
  {
    label: "Avg Trade PnL",
    getValue: (a) => a.tradeCount > 0 ? a.totalRealizedPnl / a.tradeCount : 0,
    format: (v) => `${v >= 0 ? "+" : ""}$${v.toFixed(2)}`,
    higherIsBetter: true,
  },
  {
    label: "Fees Paid",
    getValue: (a) => a.totalFeesPaid,
    format: (v) => `$${v.toFixed(2)}`,
    higherIsBetter: false,
  },
  {
    label: "Open Positions",
    getValue: (a) => a.openPositions,
    format: (v) => String(v),
    higherIsBetter: true,
  },
];

export function ComparisonMetrics({ agents, colorMap }: ComparisonMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {METRICS.map((metric) => {
        const values = agents.map((a) => ({
          id: a.id,
          value: metric.getValue(a),
        }));

        const bestValue = metric.higherIsBetter
          ? Math.max(...values.map((v) => v.value))
          : Math.min(...values.map((v) => v.value));

        return (
          <div
            key={metric.label}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
          >
            <p className="text-xs font-medium text-secondary">{metric.label}</p>
            <div className="mt-2 space-y-1.5">
              {agents.map((agent) => {
                const value = metric.getValue(agent);
                const isBest =
                  agents.length > 1 && value === bestValue;
                return (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-1.5 text-xs text-secondary">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: colorMap[agent.id] }}
                      />
                      <span className="truncate max-w-[100px]">
                        {agent.displayName}
                      </span>
                    </span>
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isBest
                          ? "font-bold text-bullish"
                          : "text-primary"
                      }`}
                    >
                      {metric.format(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
