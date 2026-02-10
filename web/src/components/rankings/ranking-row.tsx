"use client";

/**
 * RankingRow Component
 *
 * Table row for a single ranked symbol.
 * Per DESIGN_SYSTEM.md:
 * - Row height: 40px (48px on mobile for touch)
 * - Cell padding: 8px horizontal
 * - Hover: bg-elevated
 * - Expandable with chevron icon
 * - Responsive: score bar hidden on small screens
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableCell, TableRow } from "@/components/ui/table";
import type { RankingSnapshot } from "@/lib/types";
import { ScoreBar } from "./score-bar";
import { HighlightChips } from "./highlight-chip";
import { IndicatorBreakdown } from "./indicator-breakdown";

interface RankingRowProps {
  snapshot: RankingSnapshot;
  className?: string;
}

/**
 * Get score text color based on value.
 */
function getScoreColor(score: number): string {
  if (score < 0.4) return "text-bearish";
  if (score > 0.6) return "text-bullish";
  return "text-muted";
}

export function RankingRow({ snapshot, className }: RankingRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Main row */}
      <TableRow
        className={cn(
          "group/row h-10 cursor-pointer transition-colors-fast hover:bg-[var(--bg-elevated)] sm:h-10",
          isExpanded && "bg-[var(--bg-surface)]",
          className
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        {/* Rank */}
        <TableCell className="w-12 pr-2 text-right font-mono text-sm font-semibold tabular-nums text-primary">
          {snapshot.rank}
        </TableCell>

        {/* Symbol */}
        <TableCell className="w-28 font-mono text-sm font-semibold text-primary">
          <span className="flex items-center gap-1.5">
            {snapshot.symbol}
            <a
              href={`https://www.binance.com/en/trade/${snapshot.baseAsset}_${snapshot.quoteAsset}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[#F0B90B] transition-transform hover:scale-125"
              title={`Trade ${snapshot.baseAsset}/${snapshot.quoteAsset} on Binance`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 32 32" fill="currentColor">
                <path d="M16 4l4 4-4 4-4-4zm8 8l4 4-4 4-4-4zm-16 0l4 4-4 4-4-4zm8 8l4 4-4 4-4-4z" />
              </svg>
            </a>
          </span>
          {/* Mobile: show score inline below symbol */}
          <span
            className={cn(
              "block text-xs font-medium sm:hidden",
              getScoreColor(snapshot.bullishScore)
            )}
          >
            {snapshot.bullishScore.toFixed(3)}
          </span>
        </TableCell>

        {/* Score bar + value (hidden on mobile) */}
        <TableCell className="hidden w-44 sm:table-cell">
          <ScoreBar score={snapshot.bullishScore} />
        </TableCell>

        {/* Confidence */}
        <TableCell className="w-20 text-right font-mono text-sm tabular-nums text-secondary">
          {snapshot.confidence}%
        </TableCell>

        {/* Highlights (hidden on mobile and tablet) */}
        <TableCell className="hidden lg:table-cell">
          <HighlightChips highlights={snapshot.highlights} max={3} />
        </TableCell>

        {/* Expand chevron */}
        <TableCell className="w-10">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted transition-transform duration-150",
              isExpanded && "rotate-90"
            )}
          />
        </TableCell>
      </TableRow>

      {/* Expanded indicator breakdown */}
      {isExpanded && (
        <TableRow className="bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
          <TableCell colSpan={6} className="px-4 py-0">
            {/* Mobile: show highlights in expanded view */}
            {snapshot.highlights.length > 0 && (
              <div className="border-b border-[var(--border-subtle)] py-2 lg:hidden">
                <HighlightChips highlights={snapshot.highlights} max={4} />
              </div>
            )}
            <IndicatorBreakdown signals={snapshot.indicatorSignals} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
