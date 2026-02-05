"use client";

/**
 * RankingsTable Component
 *
 * Main rankings table with timeframe switching.
 * Per DESIGN_SYSTEM.md:
 * - Dense table layout (40px rows)
 * - Timeframe switching is instant (client-side only)
 * - No loading states on timeframe switch
 */

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AllTimeframeRankings, Timeframe } from "@/lib/types";
import { useTimeframe } from "@/hooks/use-timeframe";
import { TimeframeSelector } from "./timeframe-selector";
import { RankingRow } from "./ranking-row";
import { formatRelativeTime } from "@/lib/utils";

interface RankingsTableProps {
  data: AllTimeframeRankings;
  className?: string;
}

export function RankingsTable({ data, className }: RankingsTableProps) {
  const { timeframe, setTimeframe } = useTimeframe("1h");

  const currentData = data[timeframe];
  const snapshots = currentData?.snapshots ?? [];
  const computedAt = currentData?.computedAt;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header: Timeframe selector + Last updated */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <TimeframeSelector selected={timeframe} onSelect={setTimeframe} />

        {computedAt && (
          <span className="font-mono text-xs text-muted">
            Updated {formatRelativeTime(computedAt)}
          </span>
        )}
      </div>

      {/* Table */}
      <div
        role="tabpanel"
        id={`rankings-panel-${timeframe}`}
        aria-labelledby={`tab-${timeframe}`}
      >
        {snapshots.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <p className="text-secondary">
              No rankings data available for {timeframe}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
                  <TableHead className="w-12 pr-2 text-right text-xs font-medium text-secondary">
                    #
                  </TableHead>
                  <TableHead className="w-28 text-xs font-medium text-secondary">
                    Symbol
                  </TableHead>
                  <TableHead className="w-44 text-xs font-medium text-secondary">
                    Score
                  </TableHead>
                  <TableHead className="w-20 text-right text-xs font-medium text-secondary">
                    Confidence
                  </TableHead>
                  <TableHead className="hidden text-xs font-medium text-secondary md:table-cell">
                    Highlights
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <RankingRow key={snapshot.id} snapshot={snapshot} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
