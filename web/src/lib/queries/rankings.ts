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

/**
 * Fetch the latest ranking snapshots for a single timeframe.
 */
export async function getTimeframeRankings(
  timeframe: Timeframe
): Promise<RankingsData> {
  return cached(`rankings:${timeframe}`, 60, () =>
    workerGet<RankingsData>(`/rankings/${timeframe}`)
  );
}

/**
 * Fetch rankings for all 6 timeframes in parallel.
 */
export async function getAllTimeframeRankings(): Promise<AllTimeframeRankings> {
  return cached("rankings:all", 60, () =>
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
