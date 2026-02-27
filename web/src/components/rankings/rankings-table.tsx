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
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { AllTimeframeRankings, RankingSnapshot, RankingsData, Timeframe } from "@/lib/types";
import { useTimeframe } from "@/hooks/use-timeframe";
import { TimeframeSelector } from "./timeframe-selector";
import { RankingRow } from "./ranking-row";
import { CandleCountdown } from "./candle-countdown";
import { formatRelativeTime } from "@/lib/utils";
import { useTradeNotifications } from "@/components/trades/trade-notification-provider";

type SortField = "rank" | "symbol" | "score" | "confidence" | "priceChange" | "volumeChange" | "priceChangeAbs" | "volumeChangeAbs" | "fundingRate";
type SortDirection = "asc" | "desc";

function SortIndicator({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return null;
  return sortDirection === "asc" ? (
    <ChevronUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ChevronDown className="ml-1 inline h-3 w-3" />
  );
}

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
  const { highlightedSymbols } = useTradeNotifications();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // react-doctor: intentional — local mutation of server-fetched initial data
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
        case "priceChange":
          comparison = (a.priceChangePct ?? -Infinity) - (b.priceChangePct ?? -Infinity);
          break;
        case "volumeChange":
          comparison = (a.volumeChangePct ?? -Infinity) - (b.volumeChangePct ?? -Infinity);
          break;
        case "priceChangeAbs":
          comparison = (a.priceChangeAbs ?? -Infinity) - (b.priceChangeAbs ?? -Infinity);
          break;
        case "volumeChangeAbs":
          comparison = (a.volumeChangeAbs ?? -Infinity) - (b.volumeChangeAbs ?? -Infinity);
          break;
        case "fundingRate":
          comparison = (a.fundingRate ?? -Infinity) - (b.fundingRate ?? -Infinity);
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

  // Column header tooltips
  const COLUMN_TOOLTIPS: Partial<Record<SortField | "highlights", string>> = {
    score:
      "Composite bullish score (0–1). Aggregated from all technical indicators weighted by reliability. >0.6 = bullish, <0.4 = bearish.",
    confidence:
      "Measures indicator agreement — high confidence means most indicators align in the same direction.",
    priceChange:
      "Price change percentage over the selected timeframe candle vs. previous candle.",
    priceChangeAbs:
      "Absolute price change in USD over the selected timeframe.",
    volumeChange:
      "Volume change percentage over the selected timeframe candle vs. previous candle.",
    volumeChangeAbs:
      "Absolute volume change in quote currency over the selected timeframe.",
    fundingRate:
      "Perpetual futures funding rate. Negative = shorts paying longs (contrarian bullish). Positive = longs paying shorts.",
    highlights:
      "Notable technical patterns detected by the indicator engine for this symbol.",
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

        <div className="flex items-center gap-3">
          <CandleCountdown timeframe={timeframe} />
          {computedAt && (
            <span className="font-mono text-xs text-muted">
              Updated {formatRelativeTime(computedAt)}
            </span>
          )}
        </div>
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
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort("rank")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("rank"); } }}
                  >
                    #<SortIndicator field="rank" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead
                    className="w-28 cursor-pointer select-none text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort("symbol")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("symbol"); } }}
                  >
                    Symbol<SortIndicator field="symbol" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead
                    className="w-44 cursor-pointer select-none text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort("score")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("score"); } }}
                  >
                    <InfoTooltip content={COLUMN_TOOLTIPS.score!} side="bottom">
                      <span className="cursor-pointer">Score<SortIndicator field="score" sortField={sortField} sortDirection={sortDirection} /></span>
                    </InfoTooltip>
                  </TableHead>
                  <TableHead
                    className="w-20 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort("confidence")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("confidence"); } }}
                  >
                    <InfoTooltip content={COLUMN_TOOLTIPS.confidence!} side="bottom">
                      <span className="cursor-pointer">Conf<SortIndicator field="confidence" sortField={sortField} sortDirection={sortDirection} /></span>
                    </InfoTooltip>
                  </TableHead>
                  <TableHead
                    className="hidden w-20 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary md:table-cell"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort("priceChange")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("priceChange"); } }}
                  >
                    <InfoTooltip content={COLUMN_TOOLTIPS.priceChange!} side="bottom">
                      <span className="cursor-pointer">Price %<SortIndicator field="priceChange" sortField={sortField} sortDirection={sortDirection} /></span>
                    </InfoTooltip>
                  </TableHead>
                  <TableHead
                    className="hidden w-24 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary lg:table-cell"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort("priceChangeAbs")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("priceChangeAbs"); } }}
                  >
                    <InfoTooltip content={COLUMN_TOOLTIPS.priceChangeAbs!} side="bottom">
                      <span className="cursor-pointer">Price Δ<SortIndicator field="priceChangeAbs" sortField={sortField} sortDirection={sortDirection} /></span>
                    </InfoTooltip>
                  </TableHead>
                  <TableHead
                    className="hidden w-20 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary md:table-cell"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort("volumeChange")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("volumeChange"); } }}
                  >
                    <InfoTooltip content={COLUMN_TOOLTIPS.volumeChange!} side="bottom">
                      <span className="cursor-pointer">Vol %<SortIndicator field="volumeChange" sortField={sortField} sortDirection={sortDirection} /></span>
                    </InfoTooltip>
                  </TableHead>
                  <TableHead
                    className="hidden w-24 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary lg:table-cell"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort("volumeChangeAbs")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("volumeChangeAbs"); } }}
                  >
                    <InfoTooltip content={COLUMN_TOOLTIPS.volumeChangeAbs!} side="bottom">
                      <span className="cursor-pointer">Vol Δ<SortIndicator field="volumeChangeAbs" sortField={sortField} sortDirection={sortDirection} /></span>
                    </InfoTooltip>
                  </TableHead>
                  <TableHead
                    className="hidden w-20 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary lg:table-cell"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSort("fundingRate")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("fundingRate"); } }}
                  >
                    <InfoTooltip content={COLUMN_TOOLTIPS.fundingRate!} side="bottom">
                      <span className="cursor-pointer">Funding<SortIndicator field="fundingRate" sortField={sortField} sortDirection={sortDirection} /></span>
                    </InfoTooltip>
                  </TableHead>
                  <TableHead className="hidden text-xs font-medium text-secondary xl:table-cell">
                    <InfoTooltip content={COLUMN_TOOLTIPS.highlights!} side="bottom">
                      <span>Highlights</span>
                    </InfoTooltip>
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((snapshot) => (
                  <RankingRow key={snapshot.id} snapshot={snapshot} highlighted={highlightedSymbols.has(snapshot.symbol)} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
