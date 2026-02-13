/**
 * Alpha Board — TypeScript Types
 *
 * Types matching the database schema from worker/src/models/db.py
 */

// =============================================================================
// Timeframe
// =============================================================================

export type Timeframe = "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export const TIMEFRAMES: Timeframe[] = ["15m", "30m", "1h", "4h", "1d", "1w"];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

// =============================================================================
// Highlights (JSONB from snapshots.highlights)
// =============================================================================

export type HighlightSentiment = "bullish" | "bearish" | "neutral";

export interface Highlight {
  text: string;
  sentiment: HighlightSentiment;
  indicator: string;
}

// =============================================================================
// Indicator Signals (JSONB from snapshots.indicator_signals)
// =============================================================================

export interface IndicatorSignal {
  name: string;
  displayName: string;
  signal: number; // -1 to +1
  label: "bullish" | "bearish" | "neutral";
  description: string;
  rawValues: Record<string, number>;
}

// =============================================================================
// Ranking Snapshot (from snapshots table + symbol join)
// =============================================================================

export interface RankingSnapshot {
  id: number;
  symbol: string;
  symbolId: number;
  baseAsset: string;
  quoteAsset: string;
  timeframe: Timeframe;
  bullishScore: number; // 0.000 to 1.000
  confidence: number; // 0 to 100
  rank: number;
  highlights: Highlight[];
  indicatorSignals: IndicatorSignal[];
  computedAt: string; // ISO timestamp
  runId: string;
}

// =============================================================================
// Rankings Data (all timeframes combined)
// =============================================================================

export interface RankingsData {
  timeframe: Timeframe;
  snapshots: RankingSnapshot[];
  computedAt: string | null;
}

export type AllTimeframeRankings = Record<Timeframe, RankingsData>;

// =============================================================================
// Computation Run
// =============================================================================

export interface ComputationRun {
  id: string;
  timeframe: Timeframe;
  startedAt: string;
  finishedAt: string | null;
  symbolCount: number | null;
  status: "running" | "completed" | "failed";
  errorMessage: string | null;
}

// =============================================================================
// Symbol
// =============================================================================

export interface Symbol {
  id: number;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

// =============================================================================
// Indicator (from indicators table)
// =============================================================================

export interface Indicator {
  id: number;
  name: string;
  displayName: string;
  category: "momentum" | "trend" | "volatility" | "volume";
  weight: number;
  isActive: boolean;
  config: Record<string, unknown>;
}

// =============================================================================
// Agent Types
// =============================================================================

export type StrategyArchetype =
  | "momentum"
  | "mean_reversion"
  | "breakout"
  | "swing";

export const STRATEGY_ARCHETYPES: StrategyArchetype[] = [
  "momentum",
  "mean_reversion",
  "breakout",
  "swing",
];

export const STRATEGY_ARCHETYPE_LABELS: Record<StrategyArchetype, string> = {
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  breakout: "Breakout",
  swing: "Swing",
};

export type AgentTimeframe = Timeframe | "cross";

export const AGENT_TIMEFRAMES: AgentTimeframe[] = [
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
  "cross",
];

export const AGENT_TIMEFRAME_LABELS: Record<AgentTimeframe, string> = {
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
  cross: "Cross-TF",
};

export type AgentEngine = "llm" | "rule";

export const AGENT_ENGINES: AgentEngine[] = ["llm", "rule"];

export const AGENT_ENGINE_LABELS: Record<AgentEngine, string> = {
  llm: "LLM",
  rule: "Rule",
};

export type AgentStatus = "active" | "paused";

// =============================================================================
// Agent Detail Types
// =============================================================================

export interface AgentDetail {
  id: number;
  name: string;
  displayName: string;
  strategyArchetype: StrategyArchetype;
  timeframe: AgentTimeframe;
  engine: AgentEngine;
  scanModel: string;
  tradeModel: string;
  evolutionModel: string;
  status: AgentStatus;
  initialBalance: number;
  cashBalance: number;
  totalEquity: number;
  totalRealizedPnl: number;
  totalFeesPaid: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
  totalTokenCost: number;
  openPositions: number;
  lastCycleAt: string | null;
  createdAt: string;
}

export interface AgentTrade {
  id: number;
  agentId: number;
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  pnl: number;
  fees: number;
  exitReason: "agent_decision" | "stop_loss" | "take_profit";
  openedAt: string;
  closedAt: string;
  durationMinutes: number;
  reasoningSummary: string | null;
}

export interface AgentDecision {
  id: number;
  agentId: number;
  action: string;
  symbol: string | null;
  reasoningFull: string;
  reasoningSummary: string;
  actionParams: Record<string, unknown> | null;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  promptVersion: number;
  decidedAt: string;
}

export interface AgentPromptVersion {
  id: number;
  agentId: number;
  version: number;
  systemPrompt: string;
  source: "initial" | "auto" | "human";
  diffFromPrevious: string | null;
  performanceAtChange: {
    pnl?: number;
    win_rate?: number;
    trades?: number;
    drawdown?: number;
  } | null;
  createdAt: string;
  isActive: boolean;
}

export interface AgentPosition {
  id: number;
  agentId: number;
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  positionSize: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: string;
  unrealizedPnl: number;
}

export interface AgentTokenUsageSummary {
  model: string;
  taskType: "scan" | "trade" | "evolution";
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

// =============================================================================
// Agent Leaderboard
// =============================================================================

// =============================================================================
// Backtest Types
// =============================================================================

export interface BacktestRun {
  id: number;
  agentName: string;
  strategyArchetype: string;
  timeframe: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalEquity: number | null;
  totalPnl: number | null;
  totalTrades: number;
  winningTrades: number;
  maxDrawdownPct: number | null;
  sharpeRatio: number | null;
  equityCurve: { timestamp: string; equity: number }[] | null;
  status: "pending" | "running" | "completed" | "failed";
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface BacktestTrade {
  id: number;
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  pnl: number;
  fees: number;
  exitReason: string;
  entryAt: string;
  exitAt: string;
  durationMinutes: number;
}

// =============================================================================
// Agent Leaderboard
// =============================================================================

export interface AgentLeaderboardRow {
  id: number;
  name: string;
  displayName: string;
  strategyArchetype: StrategyArchetype;
  timeframe: AgentTimeframe;
  engine: AgentEngine;
  scanModel: string;
  tradeModel: string;
  evolutionModel: string;
  status: AgentStatus;
  initialBalance: number;
  cashBalance: number;
  totalEquity: number;
  totalRealizedPnl: number;
  totalFeesPaid: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
  totalTokenCost: number;
  openPositions: number;
  lastCycleAt: string | null;
}

// =============================================================================
// Analytics Types
// =============================================================================

export interface AnalyticsSummary {
  totalPnl: number;
  totalTrades: number;
  totalWins: number;
  totalFees: number;
  totalTokenCost: number;
  totalInitialBalance: number;
  maxDrawdownPct: number;
}

export interface ArchetypeStats {
  archetype: StrategyArchetype;
  agentCount: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
}

export interface TimeframeStats {
  timeframe: AgentTimeframe;
  agentCount: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
}

export interface DailyPnl {
  day: string;
  dailyPnl: number;
  cumulativePnl: number;
  tradeCount: number;
  wins: number;
}

export interface DailyArchetypePnl {
  day: string;
  archetype: StrategyArchetype;
  dailyPnl: number;
}

export interface SymbolStats {
  symbol: string;
  tradeCount: number;
  wins: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  totalFees: number;
}

export interface DailyTokenCost {
  day: string;
  dailyCost: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelCostBreakdown {
  model: string;
  taskType: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

export interface ArchetypeCost {
  archetype: StrategyArchetype;
  totalCost: number;
  totalTokens: number;
}

export interface AgentDrawdown {
  id: number;
  displayName: string;
  archetype: StrategyArchetype;
  timeframe: AgentTimeframe;
  peakEquity: number;
  totalEquity: number;
  drawdownPct: number;
}

// =============================================================================
// Chart Types
// =============================================================================

export interface CandleData {
  openTime: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorValues {
  rsi: (number | null)[];
  macd: (number | null)[];
  macdSignal: (number | null)[];
  macdHistogram: (number | null)[];
  ema20: (number | null)[];
  ema50: (number | null)[];
  ema200: (number | null)[];
  bbUpper: (number | null)[];
  bbMiddle: (number | null)[];
  bbLower: (number | null)[];
}

export interface ChartDataResponse {
  symbol: string;
  timeframe: Timeframe;
  candles: CandleData[];
  indicators: IndicatorValues;
}

export interface TradeMarker {
  time: number; // Unix seconds
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown";
  text: string;
}

// =============================================================================
// Agent Comparison
// =============================================================================

export interface ComparisonData {
  agents: AgentDetail[];
  trades: Record<number, AgentTrade[]>;
}
