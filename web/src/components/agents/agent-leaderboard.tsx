"use client";

/**
 * AgentLeaderboard Component
 *
 * Main agent leaderboard table with sorting, timeframe/archetype filtering.
 * SSE stays connected for non-price agent data (status, realized PnL, trade counts).
 * uPnL is calculated client-side from Binance prices + open positions.
 */

import { useState, useMemo, useCallback, useReducer, useEffect } from "react";
import { ChevronUp, ChevronDown, GitCompareArrows } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useSSE } from "@/hooks/use-sse";
import { useAgentPositions } from "@/hooks/use-agent-positions";
import { useDebouncedFetch } from "@/hooks/use-debounced-fetch";
import { PauseModal } from "./pause-modal";
import { AgentLeaderboardFilters } from "./agent-leaderboard-filters";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AgentEngine,
  AgentLeaderboardRow,
  AgentSource,
  AgentTimeframe,
  StrategyArchetype,
  SymbolAgentActivity,
} from "@/lib/types";
import { AgentRow } from "./agent-row";
import { TablePagination } from "@/components/ui/table-pagination";

type SortField =
  | "name"
  | "pnl"
  | "winRate"
  | "trades"
  | "openPositions"
  | "tokenCost";
type SortDirection = "asc" | "desc";

function SortIndicator({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return null;
  return sortDirection === "asc" ? (
    <ChevronUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ChevronDown className="ml-1 inline h-3 w-3" />
  );
}

interface AgentLeaderboardProps {
  agents: AgentLeaderboardRow[];
  className?: string;
}

interface AgentSSEEvent {
  type: string;
  agents?: AgentLeaderboardRow[];
}

// ─── Filter reducer ───
interface FilterState {
  timeframe: AgentTimeframe | "all";
  archetype: StrategyArchetype | "all";
  engine: AgentEngine | "all";
  source: AgentSource | "all";
  symbolSearch: string;
  sortField: SortField;
  sortDirection: SortDirection;
}

type FilterAction =
  | { type: "SET_TIMEFRAME"; value: AgentTimeframe | "all" }
  | { type: "SET_ARCHETYPE"; value: StrategyArchetype | "all" }
  | { type: "SET_ENGINE"; value: AgentEngine | "all" }
  | { type: "SET_SOURCE"; value: AgentSource | "all" }
  | { type: "SET_SYMBOL_SEARCH"; value: string }
  | { type: "TOGGLE_SORT"; field: SortField };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_TIMEFRAME":
      return { ...state, timeframe: action.value };
    case "SET_ARCHETYPE":
      return { ...state, archetype: action.value };
    case "SET_ENGINE":
      return { ...state, engine: action.value };
    case "SET_SOURCE":
      return { ...state, source: action.value };
    case "SET_SYMBOL_SEARCH":
      return { ...state, symbolSearch: action.value };
    case "TOGGLE_SORT":
      if (state.sortField === action.field) {
        return { ...state, sortDirection: state.sortDirection === "asc" ? "desc" : "asc" };
      }
      return {
        ...state,
        sortField: action.field,
        sortDirection: action.field === "name" ? "asc" : "desc",
      };
  }
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

export function AgentLeaderboard({ agents, className }: AgentLeaderboardProps) {
  const router = useRouter();

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleToggleCompare = useCallback(() => {
    setCompareMode((v) => !v);
    setSelectedIds(new Set());
  }, []);

  const handleSelectAgent = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleGoCompare = useCallback(() => {
    if (selectedIds.size >= 2) {
      const ids = Array.from(selectedIds).join(",");
      router.push(`/agents/compare?ids=${ids}`);
    }
  }, [selectedIds, router]);

  // ─── SSE data: merge server props with live SSE updates via useMemo ───
  // react-doctor: intentional — local mutation of server-fetched initial data
  const [sseAgents, setSseAgents] = useState<AgentLeaderboardRow[] | null>(null);

  const agentsData = useMemo(() => {
    if (!sseAgents) return agents;
    // SSE is active — merge status changes from server props into SSE live data
    const serverStatusMap = new Map(agents.map((a) => [a.id, a.status]));
    return sseAgents.map((a) => ({
      ...a,
      status: serverStatusMap.get(a.id) ?? a.status,
    }));
  }, [agents, sseAgents]);

  const handleSSEMessage = useCallback((event: AgentSSEEvent) => {
    if (event.type === "agent_update" && event.agents) {
      setSseAgents((prev) => {
        const sourceMap = prev ? new Map(prev.map((a) => [a.id, a.source])) : new Map<number, AgentSource>();
        return event.agents!.map((a) => ({
          ...a,
          source: a.source || sourceMap.get(a.id) || "technical",
        }));
      });
    }
  }, []);

  useSSE<AgentSSEEvent>({
    url: `${WORKER_URL}/sse/agents`,
    enabled: !!WORKER_URL,
    onMessage: handleSSEMessage,
  });

  // ─── Client-side uPnL via extracted hook ───
  const { agentUpnlMap } = useAgentPositions(agentsData);

  // ─── Filters via reducer ───
  const [filters, dispatch] = useReducer(filterReducer, {
    timeframe: "all",
    archetype: "all",
    engine: "all",
    source: "all",
    symbolSearch: "",
    sortField: "pnl",
    sortDirection: "desc",
  });

  // ─── Debounced symbol search ───
  const symbolSearchUrl = filters.symbolSearch.trim()
    ? `/api/symbols/${encodeURIComponent(filters.symbolSearch.trim().toUpperCase())}/agents`
    : null;

  const { data: symbolActivity, loading: symbolLoading } =
    useDebouncedFetch<SymbolAgentActivity>(symbolSearchUrl, 300);

  const symbolAgentIds = useMemo(() => {
    if (!filters.symbolSearch.trim()) return null;
    if (!symbolActivity) return symbolLoading ? null : new Set<number>();
    const ids = new Set<number>();
    for (const p of symbolActivity.positions) ids.add(p.agentId);
    for (const t of symbolActivity.trades) ids.add(t.agentId);
    return ids;
  }, [filters.symbolSearch, symbolActivity, symbolLoading]);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const { requireAuth } = useAuth();

  const handlePauseAllLlm = useCallback(() => {
    requireAuth(() => {
      setPauseModalOpen(true);
    });
  }, [requireAuth]);

  const handlePauseComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  const filtered = useMemo(() => {
    let result = [...agentsData];

    if (filters.timeframe !== "all") {
      result = result.filter((a) => a.timeframe === filters.timeframe);
    }
    if (filters.archetype !== "all") {
      result = result.filter((a) => a.strategyArchetype === filters.archetype);
    }
    if (filters.engine !== "all") {
      result = result.filter((a) => a.engine === filters.engine);
    }
    if (filters.source !== "all") {
      result = result.filter((a) => a.source === filters.source);
    }
    if (symbolAgentIds !== null) {
      result = result.filter((a) => symbolAgentIds.has(a.id));
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortField) {
        case "name":
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case "pnl":
          comparison = a.totalRealizedPnl - b.totalRealizedPnl;
          break;
        case "winRate":
          comparison = a.winRate - b.winRate;
          break;
        case "trades":
          comparison = a.tradeCount - b.tradeCount;
          break;
        case "openPositions":
          comparison = a.openPositions - b.openPositions;
          break;
        case "tokenCost":
          comparison = a.totalTokenCost - b.totalTokenCost;
          break;
      }
      return filters.sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [agentsData, filters.timeframe, filters.archetype, filters.engine, filters.source, symbolAgentIds, filters.sortField, filters.sortDirection]);

  // Reset page on filter/sort changes
  useEffect(() => { setPage(0); }, [
    filters.timeframe, filters.archetype, filters.engine, filters.source,
    filters.sortField, filters.sortDirection, symbolAgentIds,
  ]);

  const paginatedRows = useMemo(() => {
    if (pageSize >= filtered.length) return filtered;
    return filtered.slice(page * pageSize, (page + 1) * pageSize);
  }, [filtered, page, pageSize]);

  const handleSort = (field: SortField) => {
    dispatch({ type: "TOGGLE_SORT", field });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filters */}
      <AgentLeaderboardFilters
        timeframeFilter={filters.timeframe}
        archetypeFilter={filters.archetype}
        engineFilter={filters.engine}
        sourceFilter={filters.source}
        symbolSearch={filters.symbolSearch}
        compareMode={compareMode}
        onTimeframeChange={(v) => dispatch({ type: "SET_TIMEFRAME", value: v })}
        onArchetypeChange={(v) => dispatch({ type: "SET_ARCHETYPE", value: v })}
        onEngineChange={(v) => dispatch({ type: "SET_ENGINE", value: v })}
        onSourceChange={(v) => dispatch({ type: "SET_SOURCE", value: v })}
        onSymbolSearchChange={(v) => dispatch({ type: "SET_SYMBOL_SEARCH", value: v })}
        onToggleCompare={handleToggleCompare}
        onPauseAllLlm={handlePauseAllLlm}
      />

      {/* Results count */}
      {(filters.timeframe !== "all" || filters.archetype !== "all" || filters.engine !== "all" || filters.source !== "all" || symbolAgentIds !== null) && (
        <p className="text-xs text-secondary">
          {filtered.length} of {agentsData.length} agents
        </p>
      )}

      {/* Symbol search summary */}
      {filters.symbolSearch.trim() && symbolActivity && !symbolLoading && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-secondary">
          <span className="font-mono font-semibold text-primary">{filters.symbolSearch.trim().toUpperCase()}</span>
          <span className="text-muted">:</span>
          {symbolActivity.summary.agentsWithPositions > 0 && (
            <span>
              <span className="font-medium text-primary">{symbolActivity.summary.agentsWithPositions}</span>{" "}
              with open positions
            </span>
          )}
          {symbolActivity.summary.agentsWithPositions > 0 && symbolActivity.summary.agentsThatTraded > 0 && (
            <span className="text-muted">&middot;</span>
          )}
          {symbolActivity.summary.agentsThatTraded > 0 && (
            <span>
              <span className="font-medium text-primary">{symbolActivity.summary.agentsThatTraded}</span>{" "}
              traded
            </span>
          )}
          {symbolActivity.summary.totalTrades > 0 && (
            <>
              <span className="text-muted">&middot;</span>
              <span
                className={cn(
                  "font-mono font-medium tabular-nums",
                  symbolActivity.summary.totalPnl >= 0 ? "text-bullish" : "text-bearish"
                )}
              >
                {symbolActivity.summary.totalPnl >= 0 ? "+" : ""}${symbolActivity.summary.totalPnl.toFixed(2)}
              </span>
              <span>PnL</span>
            </>
          )}
          {symbolAgentIds !== null && symbolAgentIds.size === 0 && (
            <span>No agents found</span>
          )}
        </div>
      )}
      {filters.symbolSearch.trim() && symbolLoading && (
        <div className="h-4 w-48 animate-pulse rounded bg-[var(--bg-muted)]" />
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
          <p className="text-secondary">No agents match the current filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
                {compareMode && (
                  <TableHead className="w-10" />
                )}
                <TableHead
                  className="cursor-pointer select-none text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                  onClick={() => handleSort("name")}
                >
                  Agent
                  <SortIndicator field="name" sortField={filters.sortField} sortDirection={filters.sortDirection} />
                </TableHead>
                <TableHead className="hidden w-16 text-xs font-medium text-secondary sm:table-cell">
                  TF
                </TableHead>
                <TableHead
                  className="w-24 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                  onClick={() => handleSort("pnl")}
                >
                  Realized
                  <SortIndicator field="pnl" sortField={filters.sortField} sortDirection={filters.sortDirection} />
                </TableHead>
                <TableHead
                  className="hidden w-20 select-none text-right text-xs font-medium text-secondary sm:table-cell"
                >
                  uPnL
                </TableHead>
                <TableHead
                  className="hidden w-20 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary md:table-cell"
                  onClick={() => handleSort("winRate")}
                >
                  Win%
                  <SortIndicator field="winRate" sortField={filters.sortField} sortDirection={filters.sortDirection} />
                </TableHead>
                <TableHead
                  className="hidden w-16 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary md:table-cell"
                  onClick={() => handleSort("trades")}
                >
                  Trades
                  <SortIndicator field="trades" sortField={filters.sortField} sortDirection={filters.sortDirection} />
                </TableHead>
                <TableHead
                  className="hidden w-16 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary lg:table-cell"
                  onClick={() => handleSort("openPositions")}
                >
                  Open
                  <SortIndicator field="openPositions" sortField={filters.sortField} sortDirection={filters.sortDirection} />
                </TableHead>
                <TableHead
                  className="hidden w-20 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary lg:table-cell"
                  onClick={() => handleSort("tokenCost")}
                >
                  Cost
                  <SortIndicator field="tokenCost" sortField={filters.sortField} sortDirection={filters.sortDirection} />
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  showCheckbox={compareMode}
                  selected={selectedIds.has(agent.id)}
                  onSelect={handleSelectAgent}
                  upnlValue={agentUpnlMap.get(agent.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          pageSizeOptions={[25, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Floating compare bar */}
      {compareMode && selectedIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <button
            onClick={handleGoCompare}
            className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] px-5 py-2.5 font-mono text-sm font-semibold text-primary shadow-lg transition-colors-fast hover:bg-[var(--bg-elevated)]"
          >
            <GitCompareArrows className="h-4 w-4" />
            Compare ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Progressive pause modal */}
      <PauseModal
        open={pauseModalOpen}
        onClose={() => setPauseModalOpen(false)}
        onComplete={handlePauseComplete}
      />
    </div>
  );
}
