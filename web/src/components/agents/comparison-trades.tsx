"use client";

/**
 * ComparisonTrades — Unified trade table for agent comparison.
 * Merges all agent trades chronologically with agent-colored indicators.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentDetail, AgentTrade } from "@/lib/types";

interface ComparisonTradesProps {
  agents: AgentDetail[];
  trades: Record<number, AgentTrade[]>;
  colorMap: Record<number, string>;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

export function ComparisonTrades({
  agents,
  trades,
  colorMap,
}: ComparisonTradesProps) {
  const [filterIds, setFilterIds] = useState<Set<number>>(
    new Set(agents.map((a) => a.id))
  );

  const agentNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const a of agents) {
      map[a.id] = a.displayName;
    }
    return map;
  }, [agents]);

  const allTrades = useMemo(() => {
    const merged: (AgentTrade & { _agentName: string })[] = [];
    for (const agent of agents) {
      if (!filterIds.has(agent.id)) continue;
      const agentTrades = trades[agent.id] ?? [];
      for (const t of agentTrades) {
        merged.push({ ...t, _agentName: agentNameMap[agent.id] ?? "" });
      }
    }
    merged.sort(
      (a, b) =>
        new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
    );
    return merged.slice(0, 100);
  }, [agents, trades, filterIds, agentNameMap]);

  const toggleFilter = (id: number) => {
    setFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (allTrades.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <p className="text-xs text-muted">No closed trades yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Agent filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => toggleFilter(agent.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
              filterIds.has(agent.id)
                ? "border border-[var(--border-strong)] bg-[var(--bg-surface)] text-primary"
                : "text-secondary hover:bg-[var(--bg-elevated)] hover:text-primary"
            )}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: colorMap[agent.id],
                opacity: filterIds.has(agent.id) ? 1 : 0.4,
              }}
            />
            {agent.displayName}
          </button>
        ))}
      </div>

      {/* Trade table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
              <TableHead className="text-xs font-medium text-secondary">
                Agent
              </TableHead>
              <TableHead className="text-xs font-medium text-secondary">
                Symbol
              </TableHead>
              <TableHead className="hidden text-xs font-medium text-secondary sm:table-cell">
                Direction
              </TableHead>
              <TableHead className="text-right text-xs font-medium text-secondary">
                PnL
              </TableHead>
              <TableHead className="hidden text-right text-xs font-medium text-secondary md:table-cell">
                Entry / Exit
              </TableHead>
              <TableHead className="hidden text-right text-xs font-medium text-secondary lg:table-cell">
                Duration
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allTrades.map((trade) => (
              <TableRow
                key={`${trade.agentId}-${trade.id}`}
                className="h-10 transition-colors-fast hover:bg-[var(--bg-elevated)]"
              >
                <TableCell className="max-w-[140px]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorMap[trade.agentId] }}
                    />
                    <span className="truncate text-xs text-primary">
                      {trade._agentName}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-secondary">
                  {trade.symbol}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span
                    className={cn(
                      "font-mono text-xs",
                      trade.direction === "long"
                        ? "text-bullish"
                        : "text-bearish"
                    )}
                  >
                    {trade.direction.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-xs font-semibold tabular-nums",
                    trade.pnl > 0 && "text-bullish",
                    trade.pnl < 0 && "text-bearish",
                    trade.pnl === 0 && "text-secondary"
                  )}
                >
                  {trade.pnl >= 0 ? "+" : ""}
                  {trade.pnl.toFixed(2)}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular-nums text-secondary md:table-cell">
                  {trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted lg:table-cell">
                  {formatDuration(trade.durationMinutes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted">
        Showing {allTrades.length} most recent trades
      </p>
    </div>
  );
}
