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

import { useState, useEffect, useRef } from "react";
import { Pause, Play } from "lucide-react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { TableCell, TableRow } from "@/components/ui/table";
import type { AgentLeaderboardRow, AgentTimeframe } from "@/lib/types";
import {
  STRATEGY_ARCHETYPE_LABELS,
  AGENT_TIMEFRAME_LABELS,
} from "@/lib/types";

interface AgentRowProps {
  agent: AgentLeaderboardRow;
  showCheckbox?: boolean;
  selected?: boolean;
  onSelect?: (id: number) => void;
  liveUpnl?: boolean;
  upnlSpinner?: string;
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

/** Expected cadence thresholds in minutes per timeframe. */
const CADENCE_THRESHOLDS: Record<string, { yellow: number; gray: number }> = {
  "15m": { yellow: 10, gray: 20 },
  "30m": { yellow: 20, gray: 40 },
  "1h": { yellow: 30, gray: 60 },
  "4h": { yellow: 120, gray: 240 },
  "1d": { yellow: 480, gray: 960 },
  "1w": { yellow: 2880, gray: 5760 },
  cross: { yellow: 30, gray: 60 },
};

function getHealthStatus(
  lastCycleAt: string | null,
  timeframe: AgentTimeframe
): { color: string; label: string } {
  if (!lastCycleAt) {
    return { color: "bg-[var(--text-muted)]", label: "Never processed" };
  }

  const ageMs = Date.now() - new Date(lastCycleAt).getTime();
  const ageMinutes = ageMs / 60_000;
  const thresholds = CADENCE_THRESHOLDS[timeframe] ?? { yellow: 30, gray: 60 };

  if (ageMinutes <= thresholds.yellow) {
    return { color: "bg-[var(--bullish-strong)]", label: `Active ${Math.round(ageMinutes)}m ago` };
  }
  if (ageMinutes <= thresholds.gray) {
    return { color: "bg-yellow-500", label: `Stale ${Math.round(ageMinutes)}m ago` };
  }
  return { color: "bg-[var(--text-muted)]", label: `Inactive ${Math.round(ageMinutes)}m ago` };
}

export function AgentRow({ agent, showCheckbox, selected, onSelect, liveUpnl, upnlSpinner }: AgentRowProps) {
  const [status, setStatus] = useState(agent.status);
  const [toggling, setToggling] = useState(false);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { requireAuth } = useAuth();

  useEffect(() => {
    if (toggling) {
      spinnerRef.current = setInterval(() => {
        setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
      }, 80);
    } else {
      if (spinnerRef.current) clearInterval(spinnerRef.current);
    }
    return () => {
      if (spinnerRef.current) clearInterval(spinnerRef.current);
    };
  }, [toggling]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (toggling) return;

    requireAuth(async () => {
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
    });
  };

  const isPaused = status === "paused";
  const health = getHealthStatus(agent.lastCycleAt, agent.timeframe);

  return (
    <TableRow
      className={cn(
        "h-10 transition-colors-fast hover:bg-[var(--bg-elevated)]",
        isPaused && "opacity-50"
      )}
    >
      {/* Compare checkbox */}
      {showCheckbox && (
        <TableCell className="w-10">
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={(e) => {
              e.stopPropagation();
              onSelect?.(agent.id);
            }}
            className="h-3.5 w-3.5 cursor-pointer rounded accent-[var(--bullish)]"
          />
        </TableCell>
      )}

      {/* Agent name + archetype + engine + health dot */}
      <TableCell className="max-w-[240px]">
        <Link
          href={`/agents/${agent.id}`}
          className="group block"
        >
          <span className="flex items-center gap-1.5">
            <span
              className={cn("inline-block h-2 w-2 shrink-0 rounded-full", health.color)}
              title={health.label}
            />
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded px-1 py-0.5 font-mono text-[10px] font-bold leading-none",
                agent.engine === "rule"
                  ? "bg-[var(--bullish-subtle)] text-bullish"
                  : "bg-[var(--bg-muted)] text-secondary"
              )}
            >
              {agent.engine === "rule" ? "RULE" : "LLM"}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded px-1 py-0.5 font-mono text-[10px] font-bold leading-none",
                agent.source === "tweet"
                  ? "bg-teal-500/10 text-teal-400"
                  : agent.source === "hybrid"
                    ? "bg-purple-500/10 text-purple-400"
                    : "bg-[var(--bg-muted)] text-muted"
              )}
            >
              {agent.source === "tweet" ? "TW" : agent.source === "hybrid" ? "HYB" : "TECH"}
            </span>
            <span className="truncate text-sm font-semibold text-primary transition-colors-fast group-hover:text-[var(--bullish-strong)]">
              {agent.displayName}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {STRATEGY_ARCHETYPE_LABELS[agent.strategyArchetype]}
          </span>
        </Link>
      </TableCell>

      {/* Timeframe */}
      <TableCell className="hidden font-mono text-sm text-secondary sm:table-cell">
        {AGENT_TIMEFRAME_LABELS[agent.timeframe]}
      </TableCell>

      {/* Realized PnL */}
      <TableCell
        className={cn(
          "text-right font-mono text-sm font-semibold tabular-nums",
          agent.totalRealizedPnl > 0 && "text-bullish",
          agent.totalRealizedPnl < 0 && "text-bearish",
          agent.totalRealizedPnl === 0 && "text-secondary"
        )}
        title={`Total: ${formatPnl(agent.totalPnl)}`}
      >
        {formatPnl(agent.totalRealizedPnl)}
      </TableCell>

      {/* Unrealized PnL — only from SSE (live prices), spinner until available */}
      <TableCell
        className={cn(
          "hidden text-right font-mono text-sm tabular-nums sm:table-cell",
          !liveUpnl && "text-muted",
          liveUpnl && agent.unrealizedPnl > 0 && "text-bullish",
          liveUpnl && agent.unrealizedPnl < 0 && "text-bearish",
          liveUpnl && agent.unrealizedPnl === 0 && "text-secondary"
        )}
      >
        {liveUpnl ? formatPnl(agent.unrealizedPnl) : upnlSpinner}
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
        {agent.engine === "rule" ? "—" : formatUsd(agent.totalTokenCost)}
      </TableCell>

      {/* Status toggle */}
      <TableCell className="w-10">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors-fast",
            "hover:bg-[var(--bg-muted)]"
          )}
          title={toggling ? "Updating..." : isPaused ? "Resume agent" : "Pause agent"}
          aria-label={toggling ? "Updating..." : isPaused ? "Resume agent" : "Pause agent"}
        >
          {toggling ? (
            <span className="font-mono text-sm text-secondary">{SPINNER_FRAMES[spinnerFrame]}</span>
          ) : isPaused ? (
            <Play className="h-3.5 w-3.5 text-secondary" />
          ) : (
            <Pause className="h-3.5 w-3.5 text-secondary" />
          )}
        </button>
      </TableCell>
    </TableRow>
  );
}
