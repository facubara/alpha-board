"use client";

/**
 * SummaryCards — 6 stat cards for fleet-wide analytics overview.
 */

import { cn } from "@/lib/utils";
import { formatProfitFactor } from "@/lib/chart-theme";
import type { AnalyticsSummary } from "@/lib/types";

interface SummaryCardsProps {
  summary: AnalyticsSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const winRate =
    summary.totalTrades > 0 ? summary.totalWins / summary.totalTrades : 0;

  const avgPnlPerTrade =
    summary.totalTrades > 0 ? summary.totalPnl / summary.totalTrades : 0;

  const profitFactor =
    summary.grossLosses > 0
      ? summary.grossWins / summary.grossLosses
      : summary.grossWins > 0
        ? Infinity
        : 0;

  const metrics = [
    {
      label: "Active Agents",
      value: String(summary.activeAgents),
      color: "text-primary",
      size: "text-lg" as const,
    },
    {
      label: "Total Trades",
      value: String(summary.totalTrades),
      color: "text-primary",
      size: "text-lg" as const,
    },
    {
      label: "Win Rate",
      value: summary.totalTrades > 0 ? `${(winRate * 100).toFixed(1)}%` : "—",
      color: "text-primary",
      size: "text-lg" as const,
    },
    {
      label: "Avg PnL / Trade",
      value: summary.totalTrades > 0
        ? `${avgPnlPerTrade >= 0 ? "+" : ""}$${avgPnlPerTrade.toFixed(2)}`
        : "—",
      color:
        avgPnlPerTrade > 0
          ? "text-bullish"
          : avgPnlPerTrade < 0
            ? "text-bearish"
            : "text-secondary",
      size: "text-base" as const,
    },
    {
      label: "Profit Factor",
      value: formatProfitFactor(summary.grossWins, summary.grossLosses),
      color:
        profitFactor > 1
          ? "text-bullish"
          : profitFactor < 1 && profitFactor > 0
            ? "text-bearish"
            : "text-secondary",
      size: "text-base" as const,
    },
    {
      label: "Max Drawdown",
      value:
        summary.maxDrawdownPct < 0
          ? `${summary.maxDrawdownPct.toFixed(2)}%`
          : "0.00%",
      color: summary.maxDrawdownPct < 0 ? "text-bearish" : "text-secondary",
      size: "text-base" as const,
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
              "font-mono font-semibold",
              m.size,
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
