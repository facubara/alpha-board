/**
 * Trade Queries
 *
 * Fetches recent trades (closed + open positions) from the worker API.
 */

import { workerGet } from "@/lib/worker-client";
import type { TradeNotification } from "@/lib/types";

/**
 * Fetch recent trades: last N closed trades + all open positions.
 */
export async function getRecentTrades(
  limit: number = 50
): Promise<TradeNotification[]> {
  return workerGet<TradeNotification[]>(`/trades/recent?limit=${limit}`);
}
