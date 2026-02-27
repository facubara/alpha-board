"use client";

/**
 * AgentDetail Component
 *
 * Tabbed view for a single agent: Overview, Trade History, Reasoning, Prompt, Model Config.
 * Uses client-side Binance price fetching for live uPnL (no SSE dependency).
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBinancePrices } from "@/hooks/use-binance-prices";
import { useLiveUpnl } from "@/hooks/use-live-upnl";
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
  AgentAnalysis,
} from "@/lib/types";
import { AgentOverview } from "./agent-overview";
import { TradeHistory } from "./trade-history";
import { ReasoningLog } from "./reasoning-log";
import { PromptEditor } from "./prompt-editor";
import { PromptHistory } from "./prompt-history";
import { ModelConfig } from "./model-config";
import { AgentChart } from "./agent-chart";
import { AnalysisHistory } from "./analysis-history";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface AgentDetailProps {
  agent: AgentDetailType;
  trades: AgentTrade[];
  decisions: AgentDecision[];
  promptHistory: AgentPromptVersion[];
  positions: AgentPosition[];
  tokenUsage: AgentTokenUsageSummary[];
  analysisHistory: AgentAnalysis[];
}

export function AgentDetail({
  agent,
  trades,
  decisions,
  promptHistory,
  positions,
  tokenUsage,
  analysisHistory,
}: AgentDetailProps) {
  const activePrompt = promptHistory.find((p) => p.isActive) ?? null;

  // Extract unique symbols from open positions for Binance price polling
  const symbols = useMemo(
    () => [...new Set(positions.map((p) => p.symbol))],
    [positions]
  );

  const { prices, pricesReady } = useBinancePrices(symbols);
  const { upnl, totalPnl, equity } = useLiveUpnl(positions, prices, pricesReady, agent);

  // Display values: prefer live, fall back to DB
  const displayUpnl = upnl ?? agent.unrealizedPnl;
  const displayTotalPnl = totalPnl ?? agent.totalPnl;
  const displayEquity = equity ?? agent.totalEquity;
  const isLive = upnl !== undefined;

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
                  ? "bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]"
                  : agent.source === "hybrid"
                    ? "bg-[var(--accent-purple-subtle)] text-[var(--accent-purple)]"
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
            {agent.uuid && (
              <span className="font-mono text-xs text-muted" title={agent.uuid}>
                {agent.uuid.slice(0, 8)}
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-xs text-muted">Equity</p>
            <p className="font-mono text-sm font-semibold text-primary">
              ${displayEquity.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Realized</p>
            <p
              className={cn(
                "font-mono text-sm font-semibold",
                agent.totalRealizedPnl > 0 && "text-bullish",
                agent.totalRealizedPnl < 0 && "text-bearish",
                agent.totalRealizedPnl === 0 && "text-secondary"
              )}
            >
              {agent.totalRealizedPnl >= 0 ? "+" : ""}
              {agent.totalRealizedPnl.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Unrealized</p>
            <p
              className={cn(
                "font-mono text-sm font-semibold",
                !isLive && "text-muted",
                isLive && displayUpnl > 0 && "text-bullish",
                isLive && displayUpnl < 0 && "text-bearish",
                isLive && displayUpnl === 0 && "text-secondary"
              )}
            >
              {isLive
                ? `${displayUpnl >= 0 ? "+" : ""}${displayUpnl.toFixed(2)}`
                : SPINNER_FRAMES[0]}
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
          <TabsTrigger
            value="config"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary"
          >
            Config
          </TabsTrigger>
          {analysisHistory.length > 0 && (
            <TabsTrigger
              value="analysis"
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-secondary data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary"
            >
              Analysis ({analysisHistory.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <AgentOverview
            agent={agent}
            trades={trades}
            positions={positions}
            prices={prices}
            pricesReady={pricesReady}
            displayTotalPnl={displayTotalPnl}
            displayEquity={displayEquity}
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

        {analysisHistory.length > 0 && (
          <TabsContent value="analysis" className="pt-4">
            <AnalysisHistory analyses={analysisHistory} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
