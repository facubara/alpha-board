"use client";

/**
 * AnalyticsDashboard — Client component with 4 tabbed views.
 * Overview, Performance, Symbols, Costs.
 */

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  STRATEGY_ARCHETYPES,
  STRATEGY_ARCHETYPE_LABELS,
  AGENT_TIMEFRAMES,
  AGENT_TIMEFRAME_LABELS,
} from "@/lib/types";
import type {
  AnalyticsSummary,
  ArchetypeStats,
  TimeframeStats,
  DailyPnl,
  DailyArchetypePnl,
  SymbolStats,
  DailyTokenCost,
  ModelCostBreakdown,
  ArchetypeCost,
  AgentDrawdown,
  StrategyArchetype,
  AgentTimeframe,
} from "@/lib/types";
import { SummaryCards } from "./summary-cards";
import { CumulativePnlChart } from "./cumulative-pnl-chart";
import { HorizontalBarChart } from "./horizontal-bar-chart";
import { ArchetypeCurvesChart } from "./archetype-curves-chart";
import { DailyCostChart } from "./daily-cost-chart";
import { SymbolTable } from "./symbol-table";
import { DrawdownTable } from "./drawdown-table";
import { CostBreakdownTable } from "./cost-breakdown-table";

interface AnalyticsDashboardProps {
  summary: AnalyticsSummary;
  archetypeStats: ArchetypeStats[];
  timeframeStats: TimeframeStats[];
  dailyPnl: DailyPnl[];
  dailyArchetypePnl: DailyArchetypePnl[];
  symbolStats: SymbolStats[];
  dailyTokenCost: DailyTokenCost[];
  modelCosts: ModelCostBreakdown[];
  archetypeCosts: ArchetypeCost[];
  agentDrawdowns: AgentDrawdown[];
}

const tabTriggerClass =
  "rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary";

function FilterButtons<T extends string>({
  label,
  options,
  labels,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: T | "all";
  onSelect: (v: T | "all") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-muted">{label}:</span>
      <button
        onClick={() => onSelect("all")}
        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          selected === "all"
            ? "bg-[var(--text-primary)] text-[var(--bg-base)] ring-1 ring-[var(--text-primary)] ring-offset-1 ring-offset-[var(--bg-base)]"
            : "bg-[var(--bg-muted)] text-secondary hover:bg-[var(--bg-elevated)] hover:text-primary"
        }`}
      >
        All
      </button>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            selected === opt
              ? "bg-[var(--text-primary)] text-[var(--bg-base)] ring-1 ring-[var(--text-primary)] ring-offset-1 ring-offset-[var(--bg-base)]"
              : "bg-[var(--bg-muted)] text-secondary hover:bg-[var(--bg-elevated)] hover:text-primary"
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsDashboard({
  summary,
  archetypeStats,
  timeframeStats,
  dailyPnl,
  dailyArchetypePnl,
  symbolStats,
  dailyTokenCost,
  modelCosts,
  archetypeCosts,
  agentDrawdowns,
}: AnalyticsDashboardProps) {
  const [archFilter, setArchFilter] = useState<StrategyArchetype | "all">("all");
  const [tfFilter, setTfFilter] = useState<AgentTimeframe | "all">("all");

  // Filtered drawdowns
  const filteredDrawdowns = useMemo(() => {
    return agentDrawdowns.filter((d) => {
      if (archFilter !== "all" && d.archetype !== archFilter) return false;
      if (tfFilter !== "all" && d.timeframe !== tfFilter) return false;
      return true;
    });
  }, [agentDrawdowns, archFilter, tfFilter]);

  return (
    <Tabs defaultValue="overview">
      <TabsList className="border-b border-[var(--border-default)] bg-transparent p-0">
        <TabsTrigger value="overview" className={tabTriggerClass}>
          Overview
        </TabsTrigger>
        <TabsTrigger value="performance" className={tabTriggerClass}>
          Performance
        </TabsTrigger>
        <TabsTrigger value="symbols" className={tabTriggerClass}>
          Symbols
        </TabsTrigger>
        <TabsTrigger value="costs" className={tabTriggerClass}>
          Costs
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-6 pt-4">
        <SummaryCards summary={summary} />

        <div>
          <h3 className="mb-2 text-sm font-medium text-secondary">
            Cumulative PnL (90 days)
          </h3>
          <CumulativePnlChart data={dailyPnl} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-secondary">
              PnL by Archetype
            </h3>
            <HorizontalBarChart
              items={archetypeStats.map((a) => ({
                label: STRATEGY_ARCHETYPE_LABELS[a.archetype],
                value: a.totalPnl,
                sublabel: `${a.tradeCount} trades · ${(a.winRate * 100).toFixed(0)}% win`,
              }))}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-secondary">
              PnL by Timeframe
            </h3>
            <HorizontalBarChart
              items={timeframeStats.map((t) => ({
                label: AGENT_TIMEFRAME_LABELS[t.timeframe],
                value: t.totalPnl,
                sublabel: `${t.tradeCount} trades · ${(t.winRate * 100).toFixed(0)}% win`,
              }))}
            />
          </div>
        </div>
      </TabsContent>

      {/* Performance Tab */}
      <TabsContent value="performance" className="space-y-6 pt-4">
        <div className="flex flex-wrap gap-4">
          <FilterButtons
            label="Archetype"
            options={STRATEGY_ARCHETYPES}
            labels={STRATEGY_ARCHETYPE_LABELS}
            selected={archFilter}
            onSelect={setArchFilter}
          />
          <FilterButtons
            label="Timeframe"
            options={AGENT_TIMEFRAMES}
            labels={AGENT_TIMEFRAME_LABELS}
            selected={tfFilter}
            onSelect={setTfFilter}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-secondary">
            Cumulative PnL by Archetype
          </h3>
          <ArchetypeCurvesChart data={dailyArchetypePnl} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-secondary">
            Agents in Drawdown ({filteredDrawdowns.length})
          </h3>
          <DrawdownTable data={filteredDrawdowns} />
        </div>
      </TabsContent>

      {/* Symbols Tab */}
      <TabsContent value="symbols" className="space-y-6 pt-4">
        <div>
          <h3 className="mb-2 text-sm font-medium text-secondary">
            Top Symbols by Trade Count
          </h3>
          <SymbolTable data={symbolStats} />
        </div>
      </TabsContent>

      {/* Costs Tab */}
      <TabsContent value="costs" className="space-y-6 pt-4">
        <DailyCostChart data={dailyTokenCost} />
        <CostBreakdownTable
          modelCosts={modelCosts}
          archetypeCosts={archetypeCosts}
        />
      </TabsContent>
    </Tabs>
  );
}
