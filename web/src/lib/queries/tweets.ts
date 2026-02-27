/**
 * Twitter/Tweet Queries
 *
 * Fetches tweet data and account info from the worker API.
 */

import { workerGet } from "@/lib/worker-client";
import type { TwitterAccount, TweetData } from "@/lib/types";

/**
 * Fetch all tracked Twitter accounts with tweet counts.
 */
export async function getTwitterAccounts(): Promise<TwitterAccount[]> {
  return workerGet<TwitterAccount[]>("/twitter/accounts");
}

/**
 * Fetch recent tweets with account info and signal data.
 */
export async function getRecentTweets(limit: number = 50): Promise<TweetData[]> {
  return workerGet<TweetData[]>(`/twitter/feed?limit=${limit}`);
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
  return workerGet("/twitter/stats");
}
