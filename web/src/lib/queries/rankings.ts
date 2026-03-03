/**
 * Rankings Queries
 *
 * Fetches ranking snapshots from the worker API.
 * All timeframes are fetched in parallel for instant switching.
 */

import { cached } from "@/lib/cache";
import { workerGet } from "@/lib/worker-client";
import type {
  AllTimeframeRankings,
  RankingsData,
  Timeframe,
} from "@/lib/types";

/** Cache TTL per timeframe — matches each candle duration in seconds. */
const TIMEFRAME_CACHE_TTL: Record<Timeframe, number> = {
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,
};

const ALL_TIMEFRAMES: Timeframe[] = ["15m", "30m", "1h", "4h", "1d", "1w"];

/**
 * Fetch the latest ranking snapshots for a single timeframe.
 */
export async function getTimeframeRankings(
  timeframe: Timeframe
): Promise<RankingsData> {
  return cached(`rankings:${timeframe}`, TIMEFRAME_CACHE_TTL[timeframe], () =>
    workerGet<RankingsData>(`/rankings/${timeframe}`)
  );
}

/**
 * Fetch rankings for all 6 timeframes in a single bulk call.
 * Uses the worker's GET /rankings endpoint (returns all timeframes at once)
 * to avoid 6 separate HTTP round-trips on cold cache.
 */
export async function getAllTimeframeRankings(): Promise<AllTimeframeRankings> {
  return cached<AllTimeframeRankings>("rankings:all", 900, () =>
    workerGet<AllTimeframeRankings>("/rankings")
  );
}

/**
 * Get the latest computation run timestamp for display.
 */
export async function getLatestComputationTime(
  timeframe: Timeframe
): Promise<string | null> {
  const data = await workerGet<{ latestComputedAt: string | null }>(
    `/rankings/${timeframe}/latest-time`
  );
  return data.latestComputedAt;
}
