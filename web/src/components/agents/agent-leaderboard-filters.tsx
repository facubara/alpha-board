"use client";

import { Search, X, PauseCircle, GitCompareArrows } from "lucide-react";
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

interface AgentLeaderboardFiltersProps {
  timeframeFilter: AgentTimeframe | "all";
  archetypeFilter: StrategyArchetype | "all";
  engineFilter: AgentEngine | "all";
  sourceFilter: AgentSource | "all";
  symbolSearch: string;
  compareMode: boolean;
  onTimeframeChange: (v: AgentTimeframe | "all") => void;
  onArchetypeChange: (v: StrategyArchetype | "all") => void;
  onEngineChange: (v: AgentEngine | "all") => void;
  onSourceChange: (v: AgentSource | "all") => void;
  onSymbolSearchChange: (v: string) => void;
  onToggleCompare: () => void;
  onPauseAllLlm: () => void;
}

export function AgentLeaderboardFilters({
  timeframeFilter,
  archetypeFilter,
  engineFilter,
  sourceFilter,
  symbolSearch,
  compareMode,
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
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={symbolSearch}
            onChange={(e) => onSymbolSearchChange(e.target.value)}
            placeholder="Search symbol..."
            className="h-7 w-44 rounded-none border border-void-border bg-void pl-8 pr-8 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-void-border focus:outline-none"
          />
          {symbolSearch && (
            <button
              onClick={() => onSymbolSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
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
            onClick={onToggleCompare}
            className={cn(
              "flex items-center gap-1.5 rounded-none border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
              compareMode
                ? "border-terminal-amber text-terminal-amber"
                : "border-void-border text-text-secondary hover:text-terminal-amber hover:border-terminal-amber"
            )}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare
          </button>
          <button
            onClick={onPauseAllLlm}
            className={cn(
              "flex items-center gap-1.5 rounded-none border border-void-border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
              "text-data-loss hover:bg-terminal-amber-muted"
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
