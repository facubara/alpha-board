/**
 * Analytics Queries
 *
 * Aggregate queries for the performance dashboard / analytics page.
 * All queries hit the worker API — cached via Redis in web.
 */

import { cached } from "@/lib/cache";
import { workerGet } from "@/lib/worker-client";
import type {
  AnalyticsSummary,
  ArchetypeStats,
  SourceStats,
  TimeframeStats,
  DailyPnl,
  DailyArchetypePnl,
  SymbolStats,
  DailyTokenCost,
  ModelCostBreakdown,
  ArchetypeCost,
  AgentDrawdown,
  DirectionStats,
} from "@/lib/types";

/**
 * Fleet-wide summary totals.
 */
export function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return cached("analytics:summary", 120, async () => {
    return workerGet<AnalyticsSummary>("/analytics/summary");
  });
}

/**
 * Performance grouped by strategy archetype.
 */
export function getArchetypeStats(): Promise<ArchetypeStats[]> {
  return cached("analytics:archetype_stats", 120, async () => {
    return workerGet<ArchetypeStats[]>("/analytics/archetypes");
  });
}

/**
 * Performance grouped by source type.
 */
export function getSourceStats(): Promise<SourceStats[]> {
  return cached("analytics:source_stats", 120, async () => {
    return workerGet<SourceStats[]>("/analytics/sources");
  });
}

/**
 * Performance grouped by timeframe.
 */
export function getTimeframeStats(): Promise<TimeframeStats[]> {
  return cached("analytics:timeframe_stats", 120, async () => {
    return workerGet<TimeframeStats[]>("/analytics/timeframes");
  });
}

/**
 * Daily PnL time series with cumulative sum (90-day window).
 */
export function getDailyPnl(): Promise<DailyPnl[]> {
  return cached("analytics:daily_pnl", 120, async () => {
    return workerGet<DailyPnl[]>("/analytics/daily-pnl");
  });
}

/**
 * Daily PnL by archetype for multi-line chart (90-day window).
 */
export function getDailyArchetypePnl(): Promise<DailyArchetypePnl[]> {
  return cached("analytics:archetype_pnl", 120, async () => {
    return workerGet<DailyArchetypePnl[]>("/analytics/daily-archetype-pnl");
  });
}

/**
 * Per-symbol trade statistics (top 30 by trade count).
 */
export function getSymbolStats(): Promise<SymbolStats[]> {
  return cached("analytics:symbol_stats", 120, async () => {
    return workerGet<SymbolStats[]>("/analytics/symbols");
  });
}

/**
 * Daily token cost time series (90-day window).
 */
export function getDailyTokenCost(): Promise<DailyTokenCost[]> {
  return cached("analytics:daily_costs", 120, async () => {
    return workerGet<DailyTokenCost[]>("/analytics/daily-token-cost");
  });
}

/**
 * Token cost breakdown by model and task type.
 */
export function getModelCostBreakdown(): Promise<ModelCostBreakdown[]> {
  return cached("analytics:model_costs", 120, async () => {
    return workerGet<ModelCostBreakdown[]>("/analytics/model-costs");
  });
}

/**
 * Token cost aggregated by archetype.
 */
export function getArchetypeCost(): Promise<ArchetypeCost[]> {
  return cached("analytics:archetype_costs", 120, async () => {
    return workerGet<ArchetypeCost[]>("/analytics/archetype-costs");
  });
}

/**
 * Long vs Short fleet-wide breakdown.
 */
export function getDirectionStats(): Promise<DirectionStats[]> {
  return cached("analytics:direction_stats", 120, async () => {
    return workerGet<DirectionStats[]>("/analytics/directions");
  });
}

/**
 * Agents currently in drawdown (equity below initial balance).
 */
export function getAgentDrawdowns(): Promise<AgentDrawdown[]> {
  return cached("analytics:drawdowns", 120, async () => {
    return workerGet<AgentDrawdown[]>("/analytics/drawdowns");
  });
}
