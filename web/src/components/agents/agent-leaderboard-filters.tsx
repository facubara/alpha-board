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
    <div className="flex flex-wrap items-center gap-3">
      {/* Timeframe filter */}
      <div className="flex items-center gap-1">
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
      </div>

      <div className="hidden h-5 w-px bg-[var(--border-default)] sm:block" />

      {/* Archetype filter */}
      <div className="flex items-center gap-1">
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
      </div>

      <div className="hidden h-5 w-px bg-[var(--border-default)] sm:block" />

      {/* Engine filter */}
      <div className="flex items-center gap-1">
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
      </div>

      <div className="hidden h-5 w-px bg-[var(--border-default)] sm:block" />

      {/* Source filter */}
      <div className="flex items-center gap-1">
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
      </div>

      <div className="hidden h-5 w-px bg-[var(--border-default)] sm:block" />

      {/* Symbol search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={symbolSearch}
          onChange={(e) => onSymbolSearchChange(e.target.value)}
          placeholder="Search by symbol..."
          className="h-9 w-56 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] pl-8 pr-8 font-mono text-sm text-primary placeholder:text-muted focus:border-[var(--border-strong)] focus:outline-none"
        />
        {symbolSearch && (
          <button
            onClick={() => onSymbolSearchChange("")}
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
          onClick={onToggleCompare}
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
          onClick={onPauseAllLlm}
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
  );
}
