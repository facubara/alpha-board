/**
 * Twitter/Tweet Queries
 *
 * Fetches tweet data and account info from the worker API.
 */

import { cached } from "@/lib/cache";
import { workerGet } from "@/lib/worker-client";
import type { TwitterAccount, TweetData } from "@/lib/types";

/**
 * Fetch all tracked Twitter accounts with tweet counts.
 */
export async function getTwitterAccounts(): Promise<TwitterAccount[]> {
  return cached("tweets:accounts", 60, () =>
    workerGet<TwitterAccount[]>("/twitter/accounts")
  );
}

/**
 * Fetch recent tweets with account info and signal data.
 */
export async function getRecentTweets(limit: number = 50): Promise<TweetData[]> {
  return cached(`tweets:feed:${limit}`, 60, () =>
    workerGet<TweetData[]>(`/twitter/feed?limit=${limit}`)
  );
}

/**
 * Get tweet statistics for the dashboard, including signal breakdown.
 */
export async function getTweetStats(): Promise<{
  totalTweets: number;
  accounts: number;
  last24h: number;
  signalStats: {
    analyzed: number;
    avgSentiment: number;
    setupBreakdown: Record<string, number>;
  };
}> {
  return cached("tweets:stats", 60, () =>
    workerGet("/twitter/stats")
  );
}
