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
      <div className="flex h-32 items-center justify-center rounded-none border border-void-border bg-void-surface">
        <p className="text-xs text-text-tertiary">No closed trades yet</p>
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
              "flex items-center gap-1.5 rounded-none px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
              filterIds.has(agent.id)
                ? "border border-void-border bg-void-surface text-text-primary"
                : "text-text-secondary hover:bg-void-muted hover:text-text-primary"
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
      <div className="overflow-x-auto rounded-none border border-void-border">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-void-border bg-void-surface hover:bg-void-surface">
              <TableHead className="text-xs font-medium text-text-secondary">
                Agent
              </TableHead>
              <TableHead className="text-xs font-medium text-text-secondary">
                Symbol
              </TableHead>
              <TableHead className="hidden text-xs font-medium text-text-secondary sm:table-cell">
                Direction
              </TableHead>
              <TableHead className="text-right text-xs font-medium text-text-secondary">
                PnL
              </TableHead>
              <TableHead className="hidden text-right text-xs font-medium text-text-secondary md:table-cell">
                Entry / Exit
              </TableHead>
              <TableHead className="hidden text-right text-xs font-medium text-text-secondary lg:table-cell">
                Duration
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allTrades.map((trade) => (
              <TableRow
                key={`${trade.agentId}-${trade.id}`}
                className="h-10 transition-colors-fast hover:bg-void-muted"
              >
                <TableCell className="max-w-[140px]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorMap[trade.agentId] }}
                    />
                    <span className="truncate text-xs text-text-primary">
                      {trade._agentName}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-text-secondary">
                  {trade.symbol}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span
                    className={cn(
                      "font-mono text-xs",
                      trade.direction === "long"
                        ? "text-data-profit"
                        : "text-data-loss"
                    )}
                  >
                    {trade.direction.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-xs font-semibold tabular-nums",
                    trade.pnl > 0 && "text-data-profit",
                    trade.pnl < 0 && "text-data-loss",
                    trade.pnl === 0 && "text-text-secondary"
                  )}
                >
                  {trade.pnl >= 0 ? "+" : ""}
                  {trade.pnl.toFixed(2)}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular-nums text-text-secondary md:table-cell">
                  {trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular-nums text-text-tertiary lg:table-cell">
                  {formatDuration(trade.durationMinutes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-text-tertiary">
        Showing {allTrades.length} most recent trades
      </p>
    </div>
  );
}
