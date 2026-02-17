"use client";

/**
 * AgentLeaderboard Component
 *
 * Main agent leaderboard table with sorting, timeframe/archetype filtering.
 * Per DESIGN_SYSTEM.md:
 * - Dense table layout (40px rows)
 * - Monospace for all numbers
 * - Semantic colors for PnL only
 * - E-ink aesthetic, no decoration
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, PauseCircle, GitCompareArrows, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useSSE } from "@/hooks/use-sse";
import { PauseModal } from "./pause-modal";
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
import {
  AGENT_ENGINES,
  AGENT_ENGINE_LABELS,
  AGENT_SOURCES,
  AGENT_SOURCE_LABELS,
  AGENT_TIMEFRAMES,
  AGENT_TIMEFRAME_LABELS,
  STRATEGY_ARCHETYPES,
  STRATEGY_ARCHETYPE_LABELS,
} from "@/lib/types";
import { AgentRow } from "./agent-row";

type SortField =
  | "name"
  | "pnl"
  | "winRate"
  | "trades"
  | "openPositions"
  | "tokenCost";
type SortDirection = "asc" | "desc";

interface AgentLeaderboardProps {
  agents: AgentLeaderboardRow[];
  className?: string;
}

interface AgentSSEEvent {
  type: string;
  agents?: AgentLeaderboardRow[];
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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

  // Live state: initialized from server-fetched data, updated via SSE
  const [agentsData, setAgentsData] = useState<AgentLeaderboardRow[]>(agents);
  const [sseActive, setSseActive] = useState(false);

  // Shared spinner for uPnL cells while waiting for SSE
  const [upnlSpinnerFrame, setUpnlSpinnerFrame] = useState(0);
  useEffect(() => {
    if (sseActive) return;
    const id = setInterval(() => {
      setUpnlSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(id);
  }, [sseActive]);

  // Sync when server-fetched prop changes (e.g. after router.refresh())
  // but only if SSE hasn't taken over yet — SSE provides live PnL data
  // that is more accurate than the stale DB values in the server prop.
  useEffect(() => {
    if (!sseActive) {
      setAgentsData(agents);
    } else {
      // SSE is active — only sync status changes (pause/resume) from server,
      // but keep SSE's live PnL values
      setAgentsData((prev) => {
        const serverStatusMap = new Map(agents.map((a) => [a.id, a.status]));
        return prev.map((a) => ({
          ...a,
          status: serverStatusMap.get(a.id) ?? a.status,
        }));
      });
    }
  }, [agents, sseActive]);

  const handleSSEMessage = useCallback((event: AgentSSEEvent) => {
    if (event.type === "agent_update" && event.agents) {
      setSseActive(true);
      // SSE may not include source — preserve from existing data
      setAgentsData((prev) => {
        const sourceMap = new Map(prev.map((a) => [a.id, a.source]));
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

  const [timeframeFilter, setTimeframeFilter] = useState<
    AgentTimeframe | "all"
  >("all");
  const [archetypeFilter, setArchetypeFilter] = useState<
    StrategyArchetype | "all"
  >("all");
  const [engineFilter, setEngineFilter] = useState<AgentEngine | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<AgentSource | "all">("all");
  const [sortField, setSortField] = useState<SortField>("pnl");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [symbolAgentIds, setSymbolAgentIds] = useState<Set<number> | null>(null);
  const [symbolActivity, setSymbolActivity] = useState<SymbolAgentActivity | null>(null);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!symbolSearch.trim()) {
      setSymbolAgentIds(null);
      setSymbolActivity(null);
      setSymbolLoading(false);
      return;
    }

    setSymbolLoading(true);
    debounceRef.current = setTimeout(() => {
      const upper = symbolSearch.trim().toUpperCase();
      fetch(`/api/symbols/${encodeURIComponent(upper)}/agents`)
        .then((res) => {
          if (!res.ok) throw new Error("fetch failed");
          return res.json();
        })
        .then((data: SymbolAgentActivity) => {
          const ids = new Set<number>();
          for (const p of data.positions) ids.add(p.agentId);
          for (const t of data.trades) ids.add(t.agentId);
          setSymbolAgentIds(ids);
          setSymbolActivity(data);
        })
        .catch(() => {
          setSymbolAgentIds(new Set());
          setSymbolActivity(null);
        })
        .finally(() => setSymbolLoading(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [symbolSearch]);

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

    if (timeframeFilter !== "all") {
      result = result.filter((a) => a.timeframe === timeframeFilter);
    }
    if (archetypeFilter !== "all") {
      result = result.filter((a) => a.strategyArchetype === archetypeFilter);
    }
    if (engineFilter !== "all") {
      result = result.filter((a) => a.engine === engineFilter);
    }
    if (sourceFilter !== "all") {
      result = result.filter((a) => a.source === sourceFilter);
    }
    if (symbolAgentIds !== null) {
      result = result.filter((a) => symbolAgentIds.has(a.id));
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
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
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [agentsData, timeframeFilter, archetypeFilter, engineFilter, sourceFilter, symbolAgentIds, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Timeframe filter */}
        <div className="flex items-center gap-1">
          <FilterButton
            active={timeframeFilter === "all"}
            onClick={() => setTimeframeFilter("all")}
          >
            All
          </FilterButton>
          {AGENT_TIMEFRAMES.map((tf) => (
            <FilterButton
              key={tf}
              active={timeframeFilter === tf}
              onClick={() => setTimeframeFilter(tf)}
            >
              {AGENT_TIMEFRAME_LABELS[tf]}
            </FilterButton>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden h-5 w-px bg-[var(--border-default)] sm:block" />

        {/* Archetype filter */}
        <div className="flex items-center gap-1">
          <FilterButton
            active={archetypeFilter === "all"}
            onClick={() => setArchetypeFilter("all")}
          >
            All
          </FilterButton>
          {STRATEGY_ARCHETYPES.map((arch) => (
            <FilterButton
              key={arch}
              active={archetypeFilter === arch}
              onClick={() => setArchetypeFilter(arch)}
            >
              {STRATEGY_ARCHETYPE_LABELS[arch]}
            </FilterButton>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden h-5 w-px bg-[var(--border-default)] sm:block" />

        {/* Engine filter */}
        <div className="flex items-center gap-1">
          <FilterButton
            active={engineFilter === "all"}
            onClick={() => setEngineFilter("all")}
          >
            All
          </FilterButton>
          {AGENT_ENGINES.map((eng) => (
            <FilterButton
              key={eng}
              active={engineFilter === eng}
              onClick={() => setEngineFilter(eng)}
            >
              {AGENT_ENGINE_LABELS[eng]}
            </FilterButton>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden h-5 w-px bg-[var(--border-default)] sm:block" />

        {/* Source filter */}
        <div className="flex items-center gap-1">
          <FilterButton
            active={sourceFilter === "all"}
            onClick={() => setSourceFilter("all")}
          >
            All
          </FilterButton>
          {AGENT_SOURCES.map((src) => (
            <FilterButton
              key={src}
              active={sourceFilter === src}
              onClick={() => setSourceFilter(src)}
            >
              {AGENT_SOURCE_LABELS[src]}
            </FilterButton>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden h-5 w-px bg-[var(--border-default)] sm:block" />

        {/* Symbol search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={symbolSearch}
            onChange={(e) => setSymbolSearch(e.target.value)}
            placeholder="Search by symbol..."
            className="h-9 w-56 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] pl-8 pr-8 font-mono text-sm text-primary placeholder:text-muted focus:border-[var(--border-strong)] focus:outline-none"
          />
          {symbolSearch && (
            <button
              onClick={() => setSymbolSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Compare + Pause All LLM */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleCompare}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
              compareMode
                ? "border-[var(--border-strong)] bg-[var(--bg-surface)] text-primary"
                : "border-[var(--border-default)] text-secondary hover:bg-[var(--bg-elevated)] hover:text-primary"
            )}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare
          </button>
          <button
            onClick={handlePauseAllLlm}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
              "text-bearish hover:bg-[var(--bearish-subtle)]"
            )}
          >
            <PauseCircle className="h-3.5 w-3.5" />
            Pause All LLM
          </button>
        </div>
      </div>

      {/* Results count */}
      {(timeframeFilter !== "all" || archetypeFilter !== "all" || engineFilter !== "all" || sourceFilter !== "all" || symbolAgentIds !== null) && (
        <p className="text-xs text-secondary">
          {filtered.length} of {agentsData.length} agents
        </p>
      )}

      {/* Symbol search summary */}
      {symbolSearch.trim() && symbolActivity && !symbolLoading && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-secondary">
          <span className="font-mono font-semibold text-primary">{symbolSearch.trim().toUpperCase()}</span>
          <span className="text-muted">:</span>
          {symbolActivity.summary.agentsWithPositions > 0 && (
            <span>
              <span className="font-medium text-primary">{symbolActivity.summary.agentsWithPositions}</span>{" "}
              with open positions
            </span>
          )}
          {symbolActivity.summary.agentsWithPositions > 0 && symbolActivity.summary.agentsThatTraded > 0 && (
            <span className="text-muted">·</span>
          )}
          {symbolActivity.summary.agentsThatTraded > 0 && (
            <span>
              <span className="font-medium text-primary">{symbolActivity.summary.agentsThatTraded}</span>{" "}
              traded
            </span>
          )}
          {symbolActivity.summary.totalTrades > 0 && (
            <>
              <span className="text-muted">·</span>
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
      {symbolSearch.trim() && symbolLoading && (
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
                  <SortIndicator field="name" />
                </TableHead>
                <TableHead className="hidden w-16 text-xs font-medium text-secondary sm:table-cell">
                  TF
                </TableHead>
                <TableHead
                  className="w-24 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary"
                  onClick={() => handleSort("pnl")}
                >
                  Realized
                  <SortIndicator field="pnl" />
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
                  <SortIndicator field="winRate" />
                </TableHead>
                <TableHead
                  className="hidden w-16 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary md:table-cell"
                  onClick={() => handleSort("trades")}
                >
                  Trades
                  <SortIndicator field="trades" />
                </TableHead>
                <TableHead
                  className="hidden w-16 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary lg:table-cell"
                  onClick={() => handleSort("openPositions")}
                >
                  Open
                  <SortIndicator field="openPositions" />
                </TableHead>
                <TableHead
                  className="hidden w-20 cursor-pointer select-none text-right text-xs font-medium text-secondary transition-colors-fast hover:text-primary lg:table-cell"
                  onClick={() => handleSort("tokenCost")}
                >
                  Cost
                  <SortIndicator field="tokenCost" />
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  showCheckbox={compareMode}
                  selected={selectedIds.has(agent.id)}
                  onSelect={handleSelectAgent}
                  liveUpnl={sseActive}
                  upnlSpinner={SPINNER_FRAMES[upnlSpinnerFrame]}
                />
              ))}
            </TableBody>
          </Table>
        </div>
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

/**
 * Small filter button matching the timeframe selector style.
 */
function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
        active
          ? "border border-[var(--border-strong)] bg-[var(--bg-surface)] text-primary"
          : "text-secondary hover:bg-[var(--bg-elevated)] hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}
