/**
 * Season Queries
 *
 * Fetches per-timeframe season data from the worker API.
 */

import { cached } from "@/lib/cache";
import { workerGet } from "@/lib/worker-client";
import type { TimeframeSeason, TimeframeSeasonHistory } from "@/lib/types";

/**
 * Fetch all 5 timeframe season states.
 */
export function getAllSeasons(): Promise<TimeframeSeason[]> {
  return cached("seasons:all", 30, async () => {
    return workerGet<TimeframeSeason[]>("/seasons");
  });
}

/**
 * Fetch season history for a specific timeframe.
 */
export function getSeasonHistory(
  timeframe: string
): Promise<TimeframeSeasonHistory> {
  return cached(`seasons:history:${timeframe}`, 60, async () => {
    return workerGet<TimeframeSeasonHistory>(`/seasons/${timeframe}/history`);
  });
}
