"use client";

/**
 * AgentDetail Component
 *
 * Tabbed view for a single agent: Overview, Trade History, Reasoning, Prompt, Model Config.
 */

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  STRATEGY_ARCHETYPE_LABELS,
  AGENT_TIMEFRAME_LABELS,
  AGENT_SOURCE_LABELS,
} from "@/lib/types";
import type {
  AgentDetail as AgentDetailType,
  AgentTrade,
  AgentDecision,
  AgentPromptVersion,
  AgentPosition,
  AgentTokenUsageSummary,
} from "@/lib/types";
import { AgentOverview } from "./agent-overview";
import { TradeHistory } from "./trade-history";
import { ReasoningLog } from "./reasoning-log";
import { PromptEditor } from "./prompt-editor";
import { PromptHistory } from "./prompt-history";
import { ModelConfig } from "./model-config";
import { AgentChart } from "./agent-chart";

interface AgentDetailProps {
  agent: AgentDetailType;
  trades: AgentTrade[];
  decisions: AgentDecision[];
  promptHistory: AgentPromptVersion[];
  positions: AgentPosition[];
  tokenUsage: AgentTokenUsageSummary[];
}

export function AgentDetail({
  agent,
  trades,
  decisions,
  promptHistory,
  positions,
  tokenUsage,
}: AgentDetailProps) {
  const activePrompt = promptHistory.find((p) => p.isActive) ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-xs font-bold",
                agent.engine === "rule"
                  ? "bg-[var(--bullish-subtle)] text-bullish"
                  : "bg-[var(--bg-muted)] text-secondary"
              )}
            >
              {agent.engine === "rule" ? "RULE" : "LLM"}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-xs font-bold",
                agent.source === "tweet"
                  ? "bg-teal-500/10 text-teal-400"
                  : agent.source === "hybrid"
                    ? "bg-purple-500/10 text-purple-400"
                    : "bg-[var(--bg-muted)] text-muted"
              )}
            >
              {AGENT_SOURCE_LABELS[agent.source]}
            </span>
            <h1 className="text-xl font-semibold text-primary">
              {agent.displayName}
            </h1>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-secondary">
              {STRATEGY_ARCHETYPE_LABELS[agent.strategyArchetype]}
            </span>
            <span className="font-mono text-xs text-muted">
              {AGENT_TIMEFRAME_LABELS[agent.timeframe]}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                agent.status === "active"
                  ? "bg-[var(--bullish-subtle)] text-bullish"
                  : "bg-[var(--bg-muted)] text-muted"
              )}
            >
              {agent.status}
            </span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-xs text-muted">Equity</p>
            <p className="font-mono text-sm font-semibold text-primary">
              ${agent.totalEquity.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">PnL</p>
            <p
              className={cn(
                "font-mono text-sm font-semibold",
                agent.totalPnl > 0 && "text-bullish",
                agent.totalPnl < 0 && "text-bearish",
                agent.totalPnl === 0 && "text-secondary"
              )}
            >
              {agent.totalPnl >= 0 ? "+" : ""}
              {agent.totalPnl.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* SIMULATED TRADING disclaimer */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-muted">
        SIMULATED TRADING — All balances and trades are virtual. Not financial advice.
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="border-b border-[var(--border-default)] bg-transparent p-0">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="trades"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary"
          >
            Trades ({trades.length})
          </TabsTrigger>
          <TabsTrigger
            value="reasoning"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary"
          >
            Reasoning ({decisions.length})
          </TabsTrigger>
          <TabsTrigger
            value="chart"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary"
          >
            Chart
          </TabsTrigger>
          <TabsTrigger
            value="prompt"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary"
          >
            {agent.engine === "rule" ? "Rules" : "Prompt"}
          </TabsTrigger>
          {agent.engine !== "rule" && (
            <TabsTrigger
              value="config"
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary"
            >
              Config
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <AgentOverview
            agent={agent}
            trades={trades}
            positions={positions}
          />
        </TabsContent>

        <TabsContent value="trades" className="pt-4">
          <TradeHistory trades={trades} />
        </TabsContent>

        <TabsContent value="reasoning" className="pt-4">
          <ReasoningLog decisions={decisions} />
        </TabsContent>

        <TabsContent value="chart" className="pt-4">
          <AgentChart trades={trades} timeframe={agent.timeframe} />
        </TabsContent>

        <TabsContent value="prompt" className="space-y-6 pt-4">
          <PromptEditor agentId={agent.id} activePrompt={activePrompt} />
          <PromptHistory versions={promptHistory} />
        </TabsContent>

        <TabsContent value="config" className="pt-4">
          <ModelConfig agent={agent} tokenUsage={tokenUsage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
