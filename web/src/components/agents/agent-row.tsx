"use client";

/**
 * AgentRow Component
 *
 * Table row for a single agent on the leaderboard.
 * Terminal aesthetic:
 * - Row height: 40px
 * - Hover: bg-void-muted
 * - Monospace for numbers
 * - Semantic colors for PnL (data-profit/data-loss)
 */

import { useState, useEffect, useRef, memo } from "react";
// Pause/Play icons replaced with terminal-style text buttons

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { TableCell, TableRow } from "@/components/ui/table";
import { DottedAvatar } from "@/components/terminal";
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
  upnlValue?: number;
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
  cross: { yellow: 30, gray: 60 },
};

function getHealthStatus(
  lastCycleAt: string | null,
  timeframe: AgentTimeframe
): { color: string; label: string } {
  if (!lastCycleAt) {
    return { color: "bg-text-tertiary", label: "Never processed" };
  }

  const ageMs = Date.now() - new Date(lastCycleAt).getTime();
  const ageMinutes = ageMs / 60_000;
  const thresholds = CADENCE_THRESHOLDS[timeframe] ?? { yellow: 30, gray: 60 };

  if (ageMinutes <= thresholds.yellow) {
    return { color: "bg-data-profit", label: `Active ${Math.round(ageMinutes)}m ago` };
  }
  if (ageMinutes <= thresholds.gray) {
    return { color: "bg-terminal-amber", label: `Stale ${Math.round(ageMinutes)}m ago` };
  }
  return { color: "bg-text-tertiary", label: `Inactive ${Math.round(ageMinutes)}m ago` };
}

export const AgentRow = memo(function AgentRow({ agent, showCheckbox, selected, onSelect, upnlValue }: AgentRowProps) {
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
        setToggling(false);
      } catch {
        setToggling(false);
      }
    });
  };

  const isPaused = status === "paused";
  const health = getHealthStatus(agent.lastCycleAt, agent.timeframe);
  const hasUpnl = upnlValue !== undefined;

  return (
    <TableRow
      className={cn(
        "h-10 transition-colors-fast hover:bg-void-muted",
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
            className="h-3.5 w-3.5 cursor-pointer rounded-none accent-terminal-amber"
          />
        </TableCell>
      )}

      {/* Agent identity: avatar + name + tags */}
      <TableCell className="max-w-[300px]">
        <Link
          href={`/agents/${agent.id}`}
          className="group flex items-center gap-3"
        >
          <div className="relative shrink-0">
            <DottedAvatar
              agentId={String(agent.id)}
              gridSize={6}
              status={health.color === "bg-data-profit" ? "executing" : health.color === "bg-terminal-amber" ? "processing" : "idle"}
            />
            <span
              className={cn("absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-void-surface", health.color)}
              title={health.label}
            />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-text-primary transition-colors-fast group-hover:text-terminal-amber">
              {agent.displayName}
            </span>
            <span className="mt-0.5 flex items-center gap-1">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-none px-1 py-0.5 font-mono text-[10px] font-bold leading-none",
                  agent.engine === "rule"
                    ? "bg-terminal-amber-muted text-data-profit"
                    : "bg-void-muted text-text-secondary"
                )}
              >
                {agent.engine === "rule" ? "RULE" : "LLM"}
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-none px-1 py-0.5 font-mono text-[10px] font-bold leading-none",
                  agent.source === "tweet"
                    ? "bg-void-muted text-text-secondary"
                    : agent.source === "hybrid"
                      ? "bg-void-muted text-text-secondary"
                      : "bg-void-muted text-text-tertiary"
                )}
              >
                {agent.source === "tweet" ? "TW" : agent.source === "hybrid" ? "HYB" : "TECH"}
              </span>
              <span className="truncate text-xs text-text-tertiary">
                {STRATEGY_ARCHETYPE_LABELS[agent.strategyArchetype]}
              </span>
            </span>
          </div>
        </Link>
      </TableCell>

      {/* Timeframe */}
      <TableCell className="hidden font-mono text-sm text-text-secondary sm:table-cell">
        {AGENT_TIMEFRAME_LABELS[agent.timeframe]}
      </TableCell>

      {/* Realized PnL */}
      <TableCell
        className={cn(
          "text-right font-mono text-sm font-semibold tabular-nums",
          agent.totalRealizedPnl > 0 && "text-data-profit",
          agent.totalRealizedPnl < 0 && "text-data-loss",
          agent.totalRealizedPnl === 0 && "text-text-secondary"
        )}
        title={`Total: ${formatPnl(agent.totalPnl)}`}
      >
        {formatPnl(agent.totalRealizedPnl)}
      </TableCell>

      {/* Unrealized PnL — from client-side Binance price calculation */}
      <TableCell
        className={cn(
          "hidden text-right font-mono text-sm tabular-nums sm:table-cell",
          !hasUpnl && "text-text-tertiary",
          hasUpnl && upnlValue > 0 && "text-data-profit",
          hasUpnl && upnlValue < 0 && "text-data-loss",
          hasUpnl && upnlValue === 0 && "text-text-secondary"
        )}
      >
        {hasUpnl ? formatPnl(upnlValue) : SPINNER_FRAMES[0]}
      </TableCell>

      {/* Win Rate */}
      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-text-secondary md:table-cell">
        {agent.tradeCount > 0 ? formatPercent(agent.winRate) : "—"}
      </TableCell>

      {/* Trades */}
      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-text-secondary md:table-cell">
        {agent.tradeCount}
      </TableCell>

      {/* Open Positions */}
      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-text-secondary lg:table-cell">
        {agent.openPositions}
      </TableCell>

      {/* Token Cost */}
      <TableCell className="hidden text-right font-mono text-sm tabular-nums text-text-tertiary lg:table-cell">
        {agent.engine === "rule" ? "—" : formatUsd(agent.totalTokenCost)}
      </TableCell>

      {/* Status toggle */}
      <TableCell className="w-24">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={cn(
            "rounded-none px-2 py-1 font-mono text-xs transition-colors",
            toggling
              ? "text-text-tertiary"
              : isPaused
                ? "text-terminal-amber hover:bg-terminal-amber hover:text-void"
                : "text-text-secondary hover:text-text-primary"
          )}
          title={toggling ? "Updating..." : isPaused ? "Deploy agent" : "Pause agent"}
          aria-label={toggling ? "Updating..." : isPaused ? "Deploy agent" : "Pause agent"}
        >
          {toggling ? (
            <span>{SPINNER_FRAMES[spinnerFrame]}</span>
          ) : isPaused ? (
            "[ DEPLOY ]"
          ) : (
            "[ PAUSE ]"
          )}
        </button>
      </TableCell>
    </TableRow>
  );
}, (prev, next) => {
  return (
    prev.agent.id === next.agent.id &&
    prev.agent.status === next.agent.status &&
    prev.agent.totalRealizedPnl === next.agent.totalRealizedPnl &&
    prev.agent.tradeCount === next.agent.tradeCount &&
    prev.agent.openPositions === next.agent.openPositions &&
    prev.agent.lastCycleAt === next.agent.lastCycleAt &&
    prev.upnlValue === next.upnlValue &&
    prev.showCheckbox === next.showCheckbox &&
    prev.selected === next.selected
  );
});
