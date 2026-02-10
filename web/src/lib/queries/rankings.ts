/**
 * Rankings Queries
 *
 * Fetches ranking snapshots from Neon database.
 * All timeframes are fetched in parallel for instant switching.
 */

import { sql } from "@/lib/db";
import type {
  AllTimeframeRankings,
  Highlight,
  IndicatorSignal,
  RankingSnapshot,
  RankingsData,
  Timeframe,
  TIMEFRAMES,
} from "@/lib/types";

/**
 * Fetch the latest ranking snapshots for a single timeframe.
 *
 * Returns the most recent computation run's snapshots, ordered by rank.
 */
export async function getTimeframeRankings(
  timeframe: Timeframe
): Promise<RankingsData> {
  const rows = await sql`
    SELECT
      s.id,
      s.symbol_id,
      s.timeframe,
      s.bullish_score,
      s.confidence,
      s.rank,
      s.highlights,
      s.indicator_signals,
      s.computed_at,
      s.run_id,
      sym.symbol,
      sym.base_asset,
      sym.quote_asset
    FROM snapshots s
    JOIN symbols sym ON sym.id = s.symbol_id
    WHERE s.timeframe = ${timeframe}
      AND s.computed_at = (
        SELECT MAX(computed_at)
        FROM snapshots
        WHERE timeframe = ${timeframe}
      )
    ORDER BY s.rank ASC
  `;

  const snapshots: RankingSnapshot[] = rows.map((row) => ({
    id: Number(row.id),
    symbol: row.symbol as string,
    symbolId: Number(row.symbol_id),
    baseAsset: row.base_asset as string,
    quoteAsset: row.quote_asset as string,
    timeframe: row.timeframe as Timeframe,
    bullishScore: Number(row.bullish_score),
    confidence: Number(row.confidence),
    rank: Number(row.rank),
    highlights: (row.highlights as Highlight[]) || [],
    indicatorSignals: row.indicator_signals
      ? Object.entries(row.indicator_signals as Record<string, Record<string, unknown>>).map(
          ([name, data]) => ({
            name,
            displayName: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            signal: Number(data.signal ?? 0),
            label: (data.label as IndicatorSignal["label"]) ?? "neutral",
            description: String(data.label ?? "neutral"),
            rawValues: (data.raw as Record<string, number>) ?? {},
          })
        )
      : [],
    computedAt: (row.computed_at as Date).toISOString(),
    runId: row.run_id as string,
  }));

  return {
    timeframe,
    snapshots,
    computedAt: snapshots.length > 0 ? snapshots[0].computedAt : null,
  };
}

/**
 * Fetch rankings for all 6 timeframes in parallel.
 *
 * This enables instant timeframe switching on the client (no network request).
 */
export async function getAllTimeframeRankings(): Promise<AllTimeframeRankings> {
  const timeframes: Timeframe[] = ["15m", "30m", "1h", "4h", "1d", "1w"];

  const results = await Promise.all(
    timeframes.map((tf) => getTimeframeRankings(tf))
  );

  return {
    "15m": results[0],
    "30m": results[1],
    "1h": results[2],
    "4h": results[3],
    "1d": results[4],
    "1w": results[5],
  };
}

/**
 * Get the latest computation run timestamp for display.
 */
export async function getLatestComputationTime(
  timeframe: Timeframe
): Promise<string | null> {
  const rows = await sql`
    SELECT MAX(computed_at) as latest
    FROM snapshots
    WHERE timeframe = ${timeframe}
  `;

  if (rows.length === 0 || !rows[0].latest) {
    return null;
  }

  return (rows[0].latest as Date).toISOString();
}
