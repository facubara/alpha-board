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
import { ChevronRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TableCell, TableRow } from "@/components/ui/table";
import type { RankingSnapshot } from "@/lib/types";
import { ScoreBar } from "./score-bar";
import { HighlightChips } from "./highlight-chip";
import { IndicatorBreakdown } from "./indicator-breakdown";
import { SymbolAgentSummary } from "./symbol-agent-summary";

interface RankingRowProps {
  snapshot: RankingSnapshot;
  className?: string;
}

/**
 * Format absolute price change with smart precision.
 * >=$1: 2 decimals. <$1: up to 6 significant digits.
 */
function formatPriceAbs(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

/**
 * Format absolute volume change in compact notation.
 */
function formatVolumeAbs(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "" : "-";
  if (abs >= 1_000_000_000) return `${sign}$${(Math.abs(value) / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(Math.abs(value) / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(Math.abs(value) / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.abs(value).toFixed(0)}`;
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
            <Link
              href={`/symbols/${snapshot.symbol}`}
              onClick={(e) => e.stopPropagation()}
              className="text-secondary transition-colors hover:text-primary"
              title={`Chart for ${snapshot.symbol}`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </Link>
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
          <ScoreBar score={snapshot.bullishScore} indicatorCount={snapshot.indicatorSignals.length} />
        </TableCell>

        {/* Confidence */}
        <TableCell className="w-20 text-right font-mono text-sm tabular-nums text-secondary">
          {snapshot.confidence}%
        </TableCell>

        {/* Price % (hidden on mobile) */}
        <TableCell className="hidden w-20 text-right font-mono text-sm tabular-nums md:table-cell">
          {snapshot.priceChangePct != null ? (
            <span className={snapshot.priceChangePct >= 0 ? "text-bullish" : "text-bearish"}>
              {snapshot.priceChangePct >= 0 ? "+" : ""}
              {snapshot.priceChangePct.toFixed(2)}%
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </TableCell>

        {/* Price Δ absolute (hidden until lg) */}
        <TableCell className="hidden w-24 text-right font-mono text-sm tabular-nums lg:table-cell">
          {snapshot.priceChangeAbs != null ? (
            <span className={snapshot.priceChangeAbs >= 0 ? "text-bullish" : "text-bearish"}>
              {snapshot.priceChangeAbs >= 0 ? "+" : ""}
              {formatPriceAbs(snapshot.priceChangeAbs)}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </TableCell>

        {/* Vol % (hidden on mobile) */}
        <TableCell className="hidden w-20 text-right font-mono text-sm tabular-nums md:table-cell">
          {snapshot.volumeChangePct != null ? (
            <span className={snapshot.volumeChangePct >= 0 ? "text-bullish" : "text-bearish"}>
              {snapshot.volumeChangePct >= 0 ? "+" : ""}
              {Math.abs(snapshot.volumeChangePct) >= 1000
                ? `${(snapshot.volumeChangePct / 1000).toFixed(1)}k`
                : snapshot.volumeChangePct.toFixed(0)}
              %
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </TableCell>

        {/* Vol Δ absolute (hidden until lg) */}
        <TableCell className="hidden w-24 text-right font-mono text-sm tabular-nums lg:table-cell">
          {snapshot.volumeChangeAbs != null ? (
            <span className={snapshot.volumeChangeAbs >= 0 ? "text-bullish" : "text-bearish"}>
              {snapshot.volumeChangeAbs >= 0 ? "+" : ""}
              {formatVolumeAbs(snapshot.volumeChangeAbs)}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </TableCell>

        {/* Funding (hidden on tablet) */}
        <TableCell className="hidden w-20 text-right font-mono text-sm tabular-nums lg:table-cell">
          {snapshot.fundingRate != null ? (
            <span className={snapshot.fundingRate < 0 ? "text-teal-400" : "text-amber-400"}>
              {(snapshot.fundingRate * 100).toFixed(4)}%
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </TableCell>

        {/* Highlights (hidden until xl) */}
        <TableCell className="hidden xl:table-cell">
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
          <TableCell colSpan={11} className="px-4 py-0">
            {/* Mobile: show highlights in expanded view */}
            {snapshot.highlights.length > 0 && (
              <div className="border-b border-[var(--border-subtle)] py-2 xl:hidden">
                <HighlightChips highlights={snapshot.highlights} max={4} />
              </div>
            )}
            <IndicatorBreakdown signals={snapshot.indicatorSignals} />
            <div className="border-t border-[var(--border-subtle)]">
              <SymbolAgentSummary symbol={snapshot.symbol} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
