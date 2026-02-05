"use client";

/**
 * RankingRow Component
 *
 * Table row for a single ranked symbol.
 * Per DESIGN_SYSTEM.md:
 * - Row height: 40px
 * - Cell padding: 8px horizontal
 * - Hover: bg-elevated
 * - Expandable with chevron icon
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

export function RankingRow({ snapshot, className }: RankingRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Main row */}
      <TableRow
        className={cn(
          "h-10 cursor-pointer transition-colors-fast hover:bg-[var(--bg-elevated)]",
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
          {snapshot.symbol}
        </TableCell>

        {/* Score bar + value */}
        <TableCell className="w-44">
          <ScoreBar score={snapshot.bullishScore} />
        </TableCell>

        {/* Confidence */}
        <TableCell className="w-20 text-right font-mono text-sm tabular-nums text-secondary">
          {snapshot.confidence}%
        </TableCell>

        {/* Highlights */}
        <TableCell className="hidden md:table-cell">
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
            <IndicatorBreakdown signals={snapshot.indicatorSignals} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
