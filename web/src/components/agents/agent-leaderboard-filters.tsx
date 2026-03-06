"use client";

import { X, PauseCircle, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AgentEngine,
  AgentSource,
  AgentTimeframe,
  StrategyArchetype,
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
        "rounded-none px-2 py-1 font-mono text-xs font-medium transition-colors-fast",
        active
          ? "text-terminal-amber border-b-2 border-terminal-amber"
          : "text-text-tertiary hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-text-tertiary">{label}:</span>
      {children}
    </div>
  );
}

type StatusFilter = "all" | "active" | "paused" | "discarded";

interface AgentLeaderboardFiltersProps {
  statusFilter: StatusFilter;
  discardedCount: number;
  timeframeFilter: AgentTimeframe | "all";
  archetypeFilter: StrategyArchetype | "all";
  engineFilter: AgentEngine | "all";
  sourceFilter: AgentSource | "all";
  symbolSearch: string;
  compareMode: boolean;
  dataReady?: boolean;
  onStatusChange: (v: StatusFilter) => void;
  onTimeframeChange: (v: AgentTimeframe | "all") => void;
  onArchetypeChange: (v: StrategyArchetype | "all") => void;
  onEngineChange: (v: AgentEngine | "all") => void;
  onSourceChange: (v: AgentSource | "all") => void;
  onSymbolSearchChange: (v: string) => void;
  onToggleCompare: () => void;
  onPauseAllLlm: () => void;
}

export function AgentLeaderboardFilters({
  statusFilter,
  discardedCount,
  timeframeFilter,
  archetypeFilter,
  engineFilter,
  sourceFilter,
  symbolSearch,
  compareMode,
  dataReady = true,
  onStatusChange,
  onTimeframeChange,
  onArchetypeChange,
  onEngineChange,
  onSourceChange,
  onSymbolSearchChange,
  onToggleCompare,
  onPauseAllLlm,
}: AgentLeaderboardFiltersProps) {
  return (
    <div className="rounded-none border border-void-border bg-void-surface p-3 space-y-3">
      {/* Filter rows */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Status filter */}
        <FilterGroup label="Status">
          <FilterButton
            active={statusFilter === "all"}
            onClick={() => onStatusChange("all")}
          >
            All
          </FilterButton>
          <FilterButton
            active={statusFilter === "active"}
            onClick={() => onStatusChange("active")}
          >
            Active
          </FilterButton>
          <FilterButton
            active={statusFilter === "paused"}
            onClick={() => onStatusChange("paused")}
          >
            Paused
          </FilterButton>
          <FilterButton
            active={statusFilter === "discarded"}
            onClick={() => onStatusChange("discarded")}
          >
            Discarded{discardedCount > 0 ? ` (${discardedCount})` : ""}
          </FilterButton>
        </FilterGroup>

        <div className="hidden h-5 w-px bg-void-border sm:block" />

        {/* Timeframe filter */}
        <FilterGroup label="Timeframe">
          <FilterButton
            active={timeframeFilter === "all"}
            onClick={() => onTimeframeChange("all")}
          >
            All
          </FilterButton>
          {AGENT_TIMEFRAMES.map((tf) => (
            <FilterButton
              key={tf}
              active={timeframeFilter === tf}
              onClick={() => onTimeframeChange(tf)}
            >
              {AGENT_TIMEFRAME_LABELS[tf]}
            </FilterButton>
          ))}
        </FilterGroup>

        <div className="hidden h-5 w-px bg-void-border sm:block" />

        {/* Strategy filter */}
        <FilterGroup label="Strategy">
          <FilterButton
            active={archetypeFilter === "all"}
            onClick={() => onArchetypeChange("all")}
          >
            All
          </FilterButton>
          {STRATEGY_ARCHETYPES.map((arch) => (
            <FilterButton
              key={arch}
              active={archetypeFilter === arch}
              onClick={() => onArchetypeChange(arch)}
            >
              {STRATEGY_ARCHETYPE_LABELS[arch]}
            </FilterButton>
          ))}
        </FilterGroup>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Engine filter */}
        <FilterGroup label="Engine">
          <FilterButton
            active={engineFilter === "all"}
            onClick={() => onEngineChange("all")}
          >
            All
          </FilterButton>
          {AGENT_ENGINES.map((eng) => (
            <FilterButton
              key={eng}
              active={engineFilter === eng}
              onClick={() => onEngineChange(eng)}
            >
              {AGENT_ENGINE_LABELS[eng]}
            </FilterButton>
          ))}
        </FilterGroup>

        <div className="hidden h-5 w-px bg-void-border sm:block" />

        {/* Source filter */}
        <FilterGroup label="Source">
          <FilterButton
            active={sourceFilter === "all"}
            onClick={() => onSourceChange("all")}
          >
            All
          </FilterButton>
          {AGENT_SOURCES.map((src) => (
            <FilterButton
              key={src}
              active={sourceFilter === src}
              onClick={() => onSourceChange(src)}
            >
              {AGENT_SOURCE_LABELS[src]}
            </FilterButton>
          ))}
        </FilterGroup>

        <div className="hidden h-5 w-px bg-void-border sm:block" />

        {/* Symbol search */}
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-text-tertiary">&gt;_</span>
          <div className="relative">
            <input
              type="text"
              value={symbolSearch}
              onChange={(e) => onSymbolSearchChange(e.target.value)}
              placeholder="Search symbol..."
              className="h-7 w-48 bg-transparent border-b border-void-border text-text-primary font-mono text-xs focus:outline-none focus:border-terminal-amber px-2 py-1 placeholder:text-text-tertiary transition-colors-fast"
            />
            {symbolSearch && (
              <button
                onClick={() => onSymbolSearchChange("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Compare + Pause All LLM */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCompare}
            disabled={!dataReady}
            className={cn(
              "flex items-center gap-1.5 rounded-none border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
              !dataReady
                ? "opacity-50 pointer-events-none border-void-border text-text-secondary"
                : compareMode
                  ? "border-terminal-amber text-terminal-amber"
                  : "border-void-border text-text-secondary hover:text-terminal-amber hover:border-terminal-amber"
            )}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare
          </button>
          <button
            onClick={onPauseAllLlm}
            disabled={!dataReady}
            className={cn(
              "flex items-center gap-1.5 rounded-none border border-void-border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
              !dataReady
                ? "opacity-50 pointer-events-none"
                : "text-data-loss hover:bg-terminal-amber-muted"
            )}
          >
            <PauseCircle className="h-3.5 w-3.5" />
            Pause All LLM
          </button>
        </div>
      </div>
    </div>
  );
}
