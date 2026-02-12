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

import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useSSE } from "@/hooks/use-sse";
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
  AgentTimeframe,
  StrategyArchetype,
} from "@/lib/types";
import {
  AGENT_ENGINES,
  AGENT_ENGINE_LABELS,
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

export function AgentLeaderboard({ agents, className }: AgentLeaderboardProps) {
  // Live state: initialized from server-fetched data, updated via SSE
  const [agentsData, setAgentsData] = useState<AgentLeaderboardRow[]>(agents);

  const handleSSEMessage = useCallback((event: AgentSSEEvent) => {
    if (event.type === "agent_update" && event.agents) {
      setAgentsData(event.agents);
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
  const [sortField, setSortField] = useState<SortField>("pnl");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pausingLlm, setPausingLlm] = useState(false);
  const [pauseLlmResult, setPauseLlmResult] = useState<string | null>(null);
  const { requireAuth } = useAuth();

  const handlePauseAllLlm = useCallback(() => {
    if (pausingLlm) return;
    requireAuth(async () => {
      setPausingLlm(true);
      setPauseLlmResult(null);
      try {
        const res = await fetch("/api/agents/pause-llm", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setPauseLlmResult(`${data.paused} LLM agent${data.paused !== 1 ? "s" : ""} paused`);
          // Reload to reflect updated statuses
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setPauseLlmResult("Failed to pause");
        }
      } catch {
        setPauseLlmResult("Failed to pause");
      } finally {
        setPausingLlm(false);
      }
    });
  }, [pausingLlm, requireAuth]);

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

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case "pnl":
          comparison = a.totalPnl - b.totalPnl;
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
  }, [agentsData, timeframeFilter, archetypeFilter, engineFilter, sortField, sortDirection]);

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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Pause All LLM */}
        <div className="flex items-center gap-2">
          {pauseLlmResult && (
            <span className="text-xs text-secondary">{pauseLlmResult}</span>
          )}
          <button
            onClick={handlePauseAllLlm}
            disabled={pausingLlm}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
              "text-bearish hover:bg-[var(--bearish-subtle)]",
              pausingLlm && "opacity-50"
            )}
          >
            <PauseCircle className="h-3.5 w-3.5" />
            {pausingLlm ? "Pausing..." : "Pause All LLM"}
          </button>
        </div>
      </div>

      {/* Results count */}
      {(timeframeFilter !== "all" || archetypeFilter !== "all" || engineFilter !== "all") && (
        <p className="text-xs text-secondary">
          {filtered.length} of {agentsData.length} agents
        </p>
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
                  PnL
                  <SortIndicator field="pnl" />
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
                <AgentRow key={agent.id} agent={agent} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
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
