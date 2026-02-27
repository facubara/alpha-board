/**
 * Memecoin Queries
 *
 * Fetches watch wallets, activity, memecoin tweets, and token matches
 * from the worker API.
 */

import { workerGet } from "@/lib/worker-client";
import type {
  WatchWallet,
  WalletActivity,
  MemecoinTwitterAccount,
  MemecoinTweetData,
  MemecoinStats,
  TrendingToken,
  TrackedToken,
  TokenSnapshot,
  TokenMention,
  AccountCallHistoryItem,
} from "@/lib/types";

/**
 * Fetch watch wallets sorted by score.
 */
export async function getWatchWallets(): Promise<WatchWallet[]> {
  return workerGet<WatchWallet[]>("/memecoins/wallets");
}

/**
 * Fetch recent wallet activity.
 */
export async function getRecentWalletActivity(
  limit: number = 50
): Promise<WalletActivity[]> {
  return workerGet<WalletActivity[]>(`/memecoins/activity?limit=${limit}`);
}

/**
 * Fetch memecoin twitter accounts with tweet counts.
 */
export async function getMemecoinTwitterAccounts(): Promise<
  MemecoinTwitterAccount[]
> {
  return workerGet<MemecoinTwitterAccount[]>("/memecoins/twitter/accounts");
}

/**
 * Fetch recent memecoin tweets with signals and token matches.
 */
export async function getRecentMemecoinTweets(
  limit: number = 50
): Promise<MemecoinTweetData[]> {
  return workerGet<MemecoinTweetData[]>(`/memecoins/twitter/feed?limit=${limit}`);
}

/**
 * Get memecoin dashboard stats.
 */
export async function getMemecoinStats(): Promise<MemecoinStats> {
  return workerGet<MemecoinStats>("/memecoins/stats");
}

/**
 * Get trending tokens by mention count in the last N hours.
 */
export async function getTrendingTokens(
  hours: number = 24
): Promise<TrendingToken[]> {
  return workerGet<TrendingToken[]>(`/memecoins/trending?hours=${hours}`);
}

/**
 * Get tweets mentioning a specific token symbol within a time window.
 */
export async function getTweetsByToken(
  tokenSymbol: string,
  hours: number = 72
): Promise<TokenMention[]> {
  return workerGet<TokenMention[]>(
    `/memecoins/tokens/${encodeURIComponent(tokenSymbol)}/mentions?hours=${hours}`
  );
}

/**
 * Get call history for a specific account.
 */
export async function getAccountCallHistory(
  accountId: number
): Promise<AccountCallHistoryItem[]> {
  return workerGet<AccountCallHistoryItem[]>(
    `/memecoins/twitter/accounts/${accountId}/calls`
  );
}

/**
 * Fetch all active tracked tokens from token_tracker.
 */
export async function getTrackedTokens(): Promise<TrackedToken[]> {
  return workerGet<TrackedToken[]>("/memecoins/tracker");
}

/**
 * Batch fetch snapshots for multiple tokens (for sparklines).
 * Returns a Map from token_id to snapshots.
 */
export async function getBatchTokenSnapshots(
  tokenIds: number[]
): Promise<Map<number, TokenSnapshot[]>> {
  if (tokenIds.length === 0) return new Map();

  const data = await workerGet<Record<string, TokenSnapshot[]>>(
    `/memecoins/tracker/snapshots?ids=${tokenIds.join(",")}`
  );

  const map = new Map<number, TokenSnapshot[]>();
  for (const [key, snapshots] of Object.entries(data)) {
    map.set(Number(key), snapshots);
  }
  return map;
}
