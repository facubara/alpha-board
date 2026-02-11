"use client";

/**
 * AgentRow Component
 *
 * Table row for a single agent on the leaderboard.
 * Per DESIGN_SYSTEM.md:
 * - Row height: 40px
 * - Hover: bg-elevated
 * - Monospace for numbers
 * - Semantic colors for PnL (green/red)
 */

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TableCell, TableRow } from "@/components/ui/table";
import type { AgentLeaderboardRow } from "@/lib/types";
import {
  STRATEGY_ARCHETYPE_LABELS,
  AGENT_TIMEFRAME_LABELS,
} from "@/lib/types";

interface AgentRowProps {
  agent: AgentLeaderboardRow;
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function formatUsd(value: number): string {
  if (value < 0.01) return "$0.00";
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function AgentRow({ agent }: AgentRowProps) {
  const [status, setStatus] = useState(agent.status);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (toggling) return;

    setToggling(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/status`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      }
    } finally {
      setToggling(false);
    }
  };

  const isPaused = status === "paused";

  return (
    <TableRow
      className={cn(
        "h-10 transition-colors-fast hover:bg-[var(--bg-elevated)]",
        isPaused && "opacity-50"
      )}
    >
      {/* Agent name + archetype */}
      <TableCell className="max-w-[200px]">
        <Link
          href={`/agents/${agent.id}`}
          className="group block"
        >
          <span className="block truncate text-sm font-semibold text-primary transition-colors-fast group-hover:text-[var(--bullish-strong)]">
            {agent.displayName}
          </span>
          <span className="block text-xs text-muted">
            {STRATEGY_ARCHETYPE_LABELS[agent.strategyArchetype]}
            {" · "}
            <span className={agent.engine === "rule" ? "font-medium text-primary" : ""}>
              {agent.engine === "rule" ? "Rule" : "LLM"}
            </span>
          </span>
        </Link>
      </TableCell>

      {/* Timeframe */}
      <TableCell className="hidden font-mono text-sm text-secondary sm:table-cell">
        {AGENT_TIMEFRAME_LABELS[agent.timeframe]}
      </TableCell>

      {/* Total PnL */}
      <TableCell
        className={cn(
          "text-right font-mono text-sm font-semibold tabular-nums",
          agent.totalPnl > 0 && "text-bullish",
          agent.totalPnl < 0 && "text-bearish",
          agent.totalPnl === 0 && "text-secondary"
        )}
      >
        {formatPnl(agent.totalPnl)}
      </TableCell>

      {/* Win Rate */}
      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-secondary md:table-cell">
        {agent.tradeCount > 0 ? formatPercent(agent.winRate) : "—"}
      </TableCell>

      {/* Trades */}
      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-secondary md:table-cell">
        {agent.tradeCount}
      </TableCell>

      {/* Open Positions */}
      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-secondary lg:table-cell">
        {agent.openPositions}
      </TableCell>

      {/* Token Cost */}
      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted lg:table-cell">
        {formatUsd(agent.totalTokenCost)}
      </TableCell>

      {/* Status toggle */}
      <TableCell className="w-10">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors-fast",
            "hover:bg-[var(--bg-muted)]",
            toggling && "opacity-50"
          )}
          title={isPaused ? "Resume agent" : "Pause agent"}
          aria-label={isPaused ? "Resume agent" : "Pause agent"}
        >
          {isPaused ? (
            <Play className="h-3.5 w-3.5 text-secondary" />
          ) : (
            <Pause className="h-3.5 w-3.5 text-secondary" />
          )}
        </button>
      </TableCell>
    </TableRow>
  );
}
