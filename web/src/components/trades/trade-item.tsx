"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ArrowUpRight } from "lucide-react";
import type { TradeNotification } from "@/lib/types";
import { CopyTradeButton } from "./copy-trade-button";

function timeAgo(timestamp: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function useTimeAgo(timestamp: string): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);
  return timeAgo(timestamp);
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

export function TradeItem({
  trade,
  exchangeEnabled = false,
}: {
  trade: TradeNotification;
  exchangeEnabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const age = useTimeAgo(trade.timestamp);
  const isOpen = trade.type === "trade_opened";
  const isLong = trade.direction === "long";
  const isProfitable = trade.pnl !== null && trade.pnl > 0;

  return (
    <div
      className={`border-b border-[var(--border-default)] px-3 py-2.5 transition-colors ${
        !trade.isRead ? "bg-[var(--bg-elevated)]" : ""
      }`}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 text-left"
      >
        {/* Action + Direction pill */}
        <span
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase leading-none ${
            isLong
              ? "bg-[var(--bullish-subtle)] text-bullish"
              : "bg-[var(--bearish-subtle)] text-bearish"
          }`}
        >
          {isOpen ? "Open" : "Close"} {trade.direction}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <span className="truncate text-sm font-medium text-[var(--text-primary)]">
              {trade.symbol.replace("USDT", "")}
            </span>
            <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
              {age}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <span className="truncate">{trade.agentName}</span>
            {trade.leaderboardRank && (
              <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                #{trade.leaderboardRank}
              </span>
            )}
            <Link
              href={`/agents/${trade.agentId}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            {!isOpen && (
              <>
                <span
                  className={`shrink-0 font-mono font-medium ${
                    isProfitable ? "text-bullish" : "text-bearish"
                  }`}
                >
                  {trade.pnl !== null
                    ? `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`
                    : ""}
                </span>
                {trade.pnlPct !== null && (
                  <span
                    className={`shrink-0 text-xs ${
                      isProfitable ? "text-bullish" : "text-bearish"
                    }`}
                  >
                    ({trade.pnlPct >= 0 ? "+" : ""}
                    {trade.pnlPct.toFixed(2)}%)
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Expand icon */}
        {trade.reasoningSummary && (
          <span className="mt-1 shrink-0 text-[var(--text-tertiary)]">
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {/* Price details */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-secondary)]">
            <span>
              Entry: <span className="font-mono">{formatPrice(trade.entryPrice)}</span>
            </span>
            {trade.exitPrice !== null && (
              <span>
                Exit: <span className="font-mono">{formatPrice(trade.exitPrice)}</span>
              </span>
            )}
            {trade.stopLoss !== null && (
              <span>
                SL: <span className="font-mono">{formatPrice(trade.stopLoss)}</span>
              </span>
            )}
            {trade.takeProfit !== null && (
              <span>
                TP: <span className="font-mono">{formatPrice(trade.takeProfit)}</span>
              </span>
            )}
            {trade.exitReason && (
              <span>
                Exit:{" "}
                <span className="capitalize">
                  {trade.exitReason.replace("_", " ")}
                </span>
              </span>
            )}
            {trade.durationMinutes !== null && (
              <span>
                Duration:{" "}
                {trade.durationMinutes < 60
                  ? `${trade.durationMinutes}m`
                  : `${(trade.durationMinutes / 60).toFixed(1)}h`}
              </span>
            )}
          </div>

          {/* Copy trade button */}
          <CopyTradeButton trade={trade} exchangeEnabled={exchangeEnabled} />

          {/* Reasoning */}
          {trade.reasoningSummary && (
            <div className="rounded bg-[var(--bg-surface)] px-2.5 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              {trade.reasoningSummary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
