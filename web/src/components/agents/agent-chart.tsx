"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { AgentTrade, AgentTimeframe, TradeMarker, Timeframe } from "@/lib/types";
import { ChartContainer } from "@/components/charts/chart-container";

interface AgentChartProps {
  trades: AgentTrade[];
  timeframe: AgentTimeframe;
}

function getMostTradedSymbol(trades: AgentTrade[]): string | null {
  if (trades.length === 0) return null;

  const counts = new Map<string, number>();
  for (const t of trades) {
    counts.set(t.symbol, (counts.get(t.symbol) || 0) + 1);
  }

  let best = "";
  let bestCount = 0;
  for (const [sym, count] of counts) {
    if (count > bestCount) {
      best = sym;
      bestCount = count;
    }
  }
  return best || null;
}

function buildTradeMarkers(trades: AgentTrade[], symbol: string): TradeMarker[] {
  return trades
    .filter((t) => t.symbol === symbol)
    .map((t) => ({
      time: Math.floor(new Date(t.openedAt).getTime() / 1000),
      position: t.direction === "long" ? "belowBar" as const : "aboveBar" as const,
      color: t.direction === "long" ? "#22C55E" : "#EF4444",
      shape: t.direction === "long" ? "arrowUp" as const : "arrowDown" as const,
      text: `${t.direction === "long" ? "L" : "S"} ${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}`,
    }));
}

export function AgentChart({ trades, timeframe }: AgentChartProps) {
  const symbol = getMostTradedSymbol(trades);

  if (!symbol) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <p className="text-sm text-muted">No trades yet — chart unavailable.</p>
      </div>
    );
  }

  const markers = buildTradeMarkers(trades, symbol);

  // For cross-timeframe agents, default to 1h with timeframe selector
  const chartTimeframe: Timeframe = timeframe === "cross" ? "1h" : timeframe;
  const showSelector = timeframe === "cross";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">
          <span className="font-mono font-semibold text-primary">{symbol}</span>
          {" "}— {trades.filter((t) => t.symbol === symbol).length} trades
        </p>
        <Link
          href={`/symbols/${symbol}`}
          className="flex items-center gap-1 text-xs text-secondary transition-colors hover:text-primary"
        >
          Full Chart
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <ChartContainer
        symbol={symbol}
        initialTimeframe={chartTimeframe}
        tradeMarkers={markers}
        showTimeframeSelector={showSelector}
        height={450}
      />
    </div>
  );
}
