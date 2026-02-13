"use client";

/**
 * SymbolAgentSummary Component
 *
 * Shows agent activity (open positions + recent trades) for a symbol.
 * Fetches data lazily on mount from /api/symbols/[symbol]/agents.
 */

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { SymbolAgentActivity } from "@/lib/types";

interface SymbolAgentSummaryProps {
  symbol: string;
  className?: string;
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toFixed(2)}`;
  if (value >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SymbolAgentSummary({ symbol, className }: SymbolAgentSummaryProps) {
  const [activity, setActivity] = useState<SymbolAgentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/symbols/${encodeURIComponent(symbol)}/agents`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data: SymbolAgentActivity) => {
        if (!cancelled) setActivity(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <div className={cn("py-3", className)}>
        <div className="h-4 w-64 animate-pulse rounded bg-[var(--bg-muted)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("py-3 text-xs text-muted", className)}>
        Failed to load agent activity
      </div>
    );
  }

  if (!activity || (activity.positions.length === 0 && activity.trades.length === 0)) {
    return (
      <div className={cn("py-3 text-xs text-muted", className)}>
        No agent activity for this symbol
      </div>
    );
  }

  const { summary, positions, trades } = activity;

  return (
    <div className={cn("py-3", className)}>
      {/* Summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1 text-left text-xs text-secondary hover:text-primary"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150",
            !expanded && "-rotate-90"
          )}
        />
        <span className="flex flex-wrap gap-x-2 gap-y-0.5">
          {summary.agentsWithPositions > 0 && (
            <span>
              <span className="font-medium text-primary">{summary.agentsWithPositions}</span>{" "}
              agent{summary.agentsWithPositions !== 1 ? "s" : ""} holding positions
            </span>
          )}
          {summary.agentsWithPositions > 0 && summary.agentsThatTraded > 0 && (
            <span className="text-muted">·</span>
          )}
          {summary.agentsThatTraded > 0 && (
            <span>
              <span className="font-medium text-primary">{summary.agentsThatTraded}</span>{" "}
              agent{summary.agentsThatTraded !== 1 ? "s" : ""} traded
            </span>
          )}
          {summary.totalTrades > 0 && (
            <>
              <span className="text-muted">·</span>
              <span
                className={cn(
                  "font-mono font-medium tabular-nums",
                  summary.totalPnl >= 0 ? "text-bullish" : "text-bearish"
                )}
              >
                {formatPnl(summary.totalPnl)}
              </span>
              <span>total PnL</span>
              <span className="text-muted">·</span>
              <span>
                <span className="font-medium text-primary">{(summary.winRate * 100).toFixed(0)}%</span> win rate
              </span>
            </>
          )}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 max-w-2xl space-y-4">
          {/* Open Positions */}
          {positions.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Open Positions ({positions.length})
              </h4>
              <div className="space-y-1">
                {positions.map((pos, i) => (
                  <div
                    key={`${pos.agentId}-${i}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs"
                  >
                    <Link
                      href={`/agents/${pos.agentId}`}
                      className="min-w-[140px] truncate font-medium text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pos.agentDisplayName}
                    </Link>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] uppercase",
                        pos.direction === "long"
                          ? "bg-[var(--bullish-subtle)] text-[var(--bullish-strong)] hover:bg-[var(--bullish-subtle)]"
                          : "bg-[var(--bearish-subtle)] text-[var(--bearish-strong)] hover:bg-[var(--bearish-subtle)]"
                      )}
                    >
                      {pos.direction}
                    </Badge>
                    <span className="font-mono tabular-nums text-secondary">
                      {formatPrice(pos.entryPrice)}
                    </span>
                    <span className="font-mono tabular-nums text-secondary">
                      {pos.positionSize.toFixed(4)}
                    </span>
                    <span
                      className={cn(
                        "font-mono font-medium tabular-nums",
                        pos.unrealizedPnl >= 0 ? "text-bullish" : "text-bearish"
                      )}
                    >
                      {formatPnl(pos.unrealizedPnl)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Trades */}
          {trades.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Recent Trades ({trades.length})
              </h4>
              <div className="space-y-1">
                {trades.map((trade, i) => (
                  <div
                    key={`${trade.agentId}-${i}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs"
                  >
                    <Link
                      href={`/agents/${trade.agentId}`}
                      className="min-w-[140px] truncate font-medium text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {trade.agentDisplayName}
                    </Link>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] uppercase",
                        trade.direction === "long"
                          ? "bg-[var(--bullish-subtle)] text-[var(--bullish-strong)] hover:bg-[var(--bullish-subtle)]"
                          : "bg-[var(--bearish-subtle)] text-[var(--bearish-strong)] hover:bg-[var(--bearish-subtle)]"
                      )}
                    >
                      {trade.direction}
                    </Badge>
                    <span
                      className={cn(
                        "font-mono font-medium tabular-nums",
                        trade.pnl >= 0 ? "text-bullish" : "text-bearish"
                      )}
                    >
                      {formatPnl(trade.pnl)}
                    </span>
                    <span className="text-muted">
                      {formatDate(trade.closedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
