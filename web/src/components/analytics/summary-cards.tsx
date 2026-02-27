"use client";

/**
 * SummaryCards — 6 stat cards for fleet-wide analytics overview.
 */

import { cn } from "@/lib/utils";
import type { AnalyticsSummary } from "@/lib/types";

interface SummaryCardsProps {
  summary: AnalyticsSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const returnPct =
    summary.totalInitialBalance > 0
      ? (summary.totalPnl / summary.totalInitialBalance) * 100
      : 0;

  const winRate =
    summary.totalTrades > 0 ? summary.totalWins / summary.totalTrades : 0;

  const metrics = [
    {
      label: "Total Trades",
      value: String(summary.totalTrades),
      color: "text-primary",
    },
    {
      label: "Win Rate",
      value: summary.totalTrades > 0 ? `${(winRate * 100).toFixed(1)}%` : "—",
      color: "text-primary",
    },
    {
      label: "Total PnL",
      value: `${summary.totalPnl >= 0 ? "+" : ""}$${summary.totalPnl.toFixed(2)}`,
      color:
        summary.totalPnl > 0
          ? "text-bullish"
          : summary.totalPnl < 0
            ? "text-bearish"
            : "text-secondary",
    },
    {
      label: "Return %",
      value: `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%`,
      color:
        returnPct > 0
          ? "text-bullish"
          : returnPct < 0
            ? "text-bearish"
            : "text-secondary",
    },
    {
      label: "Max Drawdown",
      value:
        summary.maxDrawdownPct < 0
          ? `${summary.maxDrawdownPct.toFixed(2)}%`
          : "0.00%",
      color: summary.maxDrawdownPct < 0 ? "text-bearish" : "text-secondary",
    },
    {
      label: "Token Cost",
      value: `$${summary.totalTokenCost.toFixed(2)}`,
      color: "text-muted",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2"
        >
          <p className="text-xs text-muted">{m.label}</p>
          <p
            className={cn(
              "font-mono text-lg font-semibold",
              m.color
            )}
          >
            {m.value}
          </p>
        </div>
      ))}
    </div>
  );
}
