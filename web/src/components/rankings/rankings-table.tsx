"use client";

/**
 * RankingsTable Component
 *
 * Main rankings table with timeframe switching, search, sort, and live SSE updates.
 * Per DESIGN_SYSTEM.md:
 * - Dense table layout (40px rows)
 * - Timeframe switching is instant (client-side only)
 * - No loading states on timeframe switch
 * - Search filter by symbol name
 * - Sort by rank, score, confidence, symbol
 */

import { useState, useMemo, useCallback } from "react";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import { useSSE } from "@/hooks/use-sse";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import type { AllTimeframeRankings, RankingSnapshot, RankingsData, Timeframe } from "@/lib/types";
import { useTimeframe } from "@/hooks/use-timeframe";
import { TimeframeSelector } from "./timeframe-selector";
import { RankingRow } from "./ranking-row";
import { formatRelativeTime } from "@/lib/utils";

type SortField = "rank" | "symbol" | "score" | "confidence";
type SortDirection = "asc" | "desc";

interface RankingsTableProps {
  data: AllTimeframeRankings;
  className?: string;
}

interface RankingSSEEvent {
  type: string;
  timeframe?: Timeframe;
  rankings?: RankingSnapshot[];
  computedAt?: string;
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

export function RankingsTable({ data, className }: RankingsTableProps) {
  const { timeframe, setTimeframe } = useTimeframe("1h");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Live state: initialized from server-fetched data, updated via SSE
  const [rankingsData, setRankingsData] = useState<AllTimeframeRankings>(data);

  const handleSSEMessage = useCallback((event: RankingSSEEvent) => {
    if (event.type === "ranking_update" && event.timeframe && event.rankings) {
      setRankingsData((prev) => ({
        ...prev,
        [event.timeframe!]: {
          timeframe: event.timeframe!,
          snapshots: event.rankings!,
          computedAt: event.computedAt ?? null,
        } satisfies RankingsData,
      }));
    }
  }, []);

  useSSE<RankingSSEEvent>({
    url: `${WORKER_URL}/sse/rankings`,
    enabled: !!WORKER_URL,
    onMessage: handleSSEMessage,
  });

  const currentData = rankingsData[timeframe];
  const snapshots = currentData?.snapshots ?? [];
  const computedAt = currentData?.computedAt;

  // Filter and sort snapshots
  const filteredAndSorted = useMemo(() => {
    let result = [...snapshots];

    // Filter by search term
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.symbol.toLowerCase().includes(term) ||
          s.baseAsset.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "rank":
          comparison = a.rank - b.rank;
          break;
        case "symbol":
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case "score":
          comparison = a.bullishScore - b.bullishScore;
          break;
        case "confidence":
          comparison = a.confidence - b.confidence;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [snapshots, search, sortField, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      // New field, default direction
      setSortField(field);
      setSortDirection(field === "symbol" ? "asc" : "desc");
    }
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3" />
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header: Timeframe selector + Search + Last updated */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <TimeframeSelector selected={timeframe} onSelect={setTimeframe} />

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              type="text"
              placeholder="Search symbols..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-48 pl-8 font-mono text-sm"
            />
          </div>
        </div>

        {computedAt && (
          <span className="font-mono text-xs text-muted">
            Updated {formatRelativeTime(computedAt)}
          </span>
        )}
      </div>

      {/* Results count when filtering */}
      {search.trim() && (
        <p className="text-xs text-secondary">
          {filteredAndSorted.length} of {snapshots.length} symbols
        </p>
      )}

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
        ) : filteredAndSorted.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <p className="text-secondary">
              No symbols match &quot;{search}&quot;
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
                  <TableHead
                    className="w-12 cursor-pointer select-none pr-2 text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                    onClick={() => handleSort("rank")}
                  >
                    #<SortIndicator field="rank" />
                  </TableHead>
                  <TableHead
                    className="w-28 cursor-pointer select-none text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                    onClick={() => handleSort("symbol")}
                  >
                    Symbol<SortIndicator field="symbol" />
                  </TableHead>
                  <TableHead
                    className="w-44 cursor-pointer select-none text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                    onClick={() => handleSort("score")}
                  >
                    Score<SortIndicator field="score" />
                  </TableHead>
                  <TableHead
                    className="w-20 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                    onClick={() => handleSort("confidence")}
                  >
                    Conf<SortIndicator field="confidence" />
                  </TableHead>
                  <TableHead className="hidden text-xs font-medium text-secondary lg:table-cell">
                    Highlights
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((snapshot) => (
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
