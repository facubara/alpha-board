"use client";

import type { TimeframeSeason } from "@/lib/types";
import { DottedProgress } from "@/components/terminal";

const DURATION_LABELS: Record<string, string> = {
  "15m": "1 week seasons",
  "30m": "2 week seasons",
  "1h": "1 month seasons",
  "4h": "3 month seasons",
  "1d": "6 month seasons",
};

function formatPnl(pnl: number | null): string {
  if (pnl === null) return "$0.00";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}$${pnl.toFixed(2)}`;
}

function formatDaysRemaining(days: number): string {
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `${hours}h remaining`;
  }
  if (days === 1) return "1 day remaining";
  return `${Math.round(days)}d remaining`;
}

interface Props {
  season: TimeframeSeason;
  isSelected: boolean;
  onClick: () => void;
}

export function TimeframeSeasonCard({ season, isSelected, onClick }: Props) {
  const pnlColor =
    season.topAgent && season.topAgent.pnl !== null
      ? season.topAgent.pnl >= 0
        ? "text-data-profit"
        : "text-data-loss"
      : "text-text-tertiary";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-none border p-4 text-left transition-colors-fast hover:border-terminal-amber ${
        isSelected
          ? "border-terminal-amber bg-void-muted"
          : "border-void-border bg-void-surface"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-lg font-bold text-text-primary">
            {season.timeframe.toUpperCase()}
          </span>
          <span className="ml-2 text-sm text-text-secondary">
            Season {season.currentSeason}
          </span>
        </div>
        <span className="text-xs text-text-tertiary">
          {DURATION_LABELS[season.timeframe]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <DottedProgress progress={season.progressPct} activeColor="bg-terminal-amber" />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-text-secondary">
          {season.progressPct.toFixed(1)}% complete
        </span>
        <span className="text-text-tertiary">
          {formatDaysRemaining(season.daysRemaining)}
        </span>
      </div>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-4 text-xs">
        <span className="text-text-secondary">
          <span className="font-medium text-text-primary">{season.tradeCount}</span>{" "}
          trades
        </span>
        <span className="text-text-secondary">
          <span className="font-medium text-text-primary">{season.agentCount}</span>{" "}
          agents
        </span>
      </div>

      {/* Top agent */}
      {season.topAgent && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="truncate text-text-tertiary">
            {season.topAgent.displayName}
          </span>
          <span className={`font-mono font-medium ${pnlColor}`}>
            {formatPnl(season.topAgent.pnl)}
          </span>
        </div>
      )}
    </button>
  );
}
