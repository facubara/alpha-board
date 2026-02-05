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
