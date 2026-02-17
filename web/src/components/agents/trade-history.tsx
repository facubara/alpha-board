"use client";

/**
 * TradeHistory Tab
 *
 * Chronological trade list with expandable reasoning.
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentTrade } from "@/lib/types";

interface TradeHistoryProps {
  trades: AgentTrade[];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (trades.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <p className="text-sm text-muted">No trades yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
            <TableHead className="text-xs font-medium text-secondary">Symbol</TableHead>
            <TableHead className="text-xs font-medium text-secondary">Dir</TableHead>
            <TableHead className="hidden text-right text-xs font-medium text-secondary sm:table-cell">Entry</TableHead>
            <TableHead className="hidden text-right text-xs font-medium text-secondary sm:table-cell">Exit</TableHead>
            <TableHead className="hidden text-right text-xs font-medium text-secondary md:table-cell">Size</TableHead>
            <TableHead className="text-right text-xs font-medium text-secondary">PnL</TableHead>
            <TableHead className="hidden text-xs font-medium text-secondary md:table-cell">Exit</TableHead>
            <TableHead className="hidden text-right text-xs font-medium text-secondary lg:table-cell">Dur</TableHead>
            <TableHead className="hidden text-right text-xs font-medium text-muted lg:table-cell">Opened</TableHead>
            <TableHead className="hidden text-right text-xs font-medium text-muted lg:table-cell">Closed</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => {
            const isExpanded = expandedId === trade.id;
            return (
              <TradeRow
                key={trade.id}
                trade={trade}
                isExpanded={isExpanded}
                onToggle={() =>
                  setExpandedId(isExpanded ? null : trade.id)
                }
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TradeRow({
  trade,
  isExpanded,
  onToggle,
}: {
  trade: AgentTrade;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const exitLabel =
    trade.exitReason === "stop_loss"
      ? "SL"
      : trade.exitReason === "take_profit"
        ? "TP"
        : "Manual";

  return (
    <>
      <TableRow
        className={cn(
          "h-10 cursor-pointer transition-colors-fast hover:bg-[var(--bg-elevated)]",
          isExpanded && "bg-[var(--bg-surface)]"
        )}
        onClick={onToggle}
      >
        <TableCell className="font-mono text-sm font-semibold text-primary">
          {trade.symbol}
        </TableCell>
        <TableCell>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium",
              trade.direction === "long"
                ? "bg-[var(--bullish-subtle)] text-bullish"
                : "bg-[var(--bearish-subtle)] text-bearish"
            )}
          >
            {trade.direction.toUpperCase()}
          </span>
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm tabular-nums text-secondary sm:table-cell">
          {trade.entryPrice.toPrecision(6)}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm tabular-nums text-secondary sm:table-cell">
          {trade.exitPrice.toPrecision(6)}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm tabular-nums text-secondary md:table-cell">
          ${trade.positionSize.toFixed(0)}
        </TableCell>
        <TableCell
          className={cn(
            "text-right font-mono text-sm font-semibold tabular-nums",
            trade.pnl > 0 && "text-bullish",
            trade.pnl < 0 && "text-bearish",
            trade.pnl === 0 && "text-secondary"
          )}
        >
          {trade.pnl >= 0 ? "+" : ""}
          {trade.pnl.toFixed(2)}
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium",
              trade.exitReason === "stop_loss" && "bg-[var(--bearish-subtle)] text-bearish",
              trade.exitReason === "take_profit" && "bg-[var(--bullish-subtle)] text-bullish",
              trade.exitReason === "agent_decision" && "bg-[var(--bg-muted)] text-secondary"
            )}
          >
            {exitLabel}
          </span>
        </TableCell>
        <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted lg:table-cell">
          {formatDuration(trade.durationMinutes)}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted lg:table-cell" title={`Local: ${formatTimestamp(trade.openedAt).local}`}>
          {formatTimestamp(trade.openedAt).utc}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted lg:table-cell" title={`Local: ${formatTimestamp(trade.closedAt).local}`}>
          {formatTimestamp(trade.closedAt).utc}
        </TableCell>
        <TableCell className="w-8">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted transition-transform duration-150",
              isExpanded && "rotate-90"
            )}
          />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
          <TableCell colSpan={11} className="px-4 py-3">
            <p className="text-sm leading-relaxed text-secondary">
              {trade.reasoningSummary || "No reasoning recorded for this trade."}
            </p>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
