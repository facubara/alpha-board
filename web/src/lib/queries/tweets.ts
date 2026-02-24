/**
 * Twitter/Tweet Queries
 *
 * Fetches tweet data and account info from Neon database.
 */

import { sql } from "@/lib/db";
import type { TwitterAccount, TwitterAccountCategory, TweetData, TweetSignal, TweetSetupType } from "@/lib/types";

/**
 * Fetch all tracked Twitter accounts with tweet counts.
 */
export async function getTwitterAccounts(): Promise<TwitterAccount[]> {
  const rows = await sql`
    SELECT
      ta.id,
      ta.handle,
      ta.display_name,
      ta.category,
      ta.followers_count,
      ta.bio,
      ta.is_active,
      ta.added_at,
      COUNT(t.id) AS tweet_count
    FROM twitter_accounts ta
    LEFT JOIN tweets t ON t.twitter_account_id = ta.id
    GROUP BY ta.id
    ORDER BY ta.added_at DESC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    handle: row.handle as string,
    displayName: row.display_name as string,
    category: row.category as TwitterAccountCategory,
    followersCount: row.followers_count != null ? Number(row.followers_count) : null,
    bio: (row.bio as string) || null,
    isActive: row.is_active as boolean,
    addedAt: (row.added_at as Date).toISOString(),
    tweetCount: Number(row.tweet_count),
  }));
}

/**
 * Fetch recent tweets with account info and signal data.
 */
export async function getRecentTweets(limit: number = 50): Promise<TweetData[]> {
  const rows = await sql`
    SELECT
      t.id,
      t.tweet_id,
      t.text,
      t.created_at,
      t.metrics,
      t.ingested_at,
      ta.handle AS account_handle,
      ta.display_name AS account_display_name,
      ta.category AS account_category,
      ts.sentiment_score,
      ts.setup_type,
      ts.confidence AS signal_confidence,
      ts.symbols_mentioned,
      ts.reasoning
    FROM tweets t
    JOIN twitter_accounts ta ON ta.id = t.twitter_account_id
    LEFT JOIN tweet_signals ts ON ts.tweet_id = t.id
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => {
    const tweet: TweetData = {
      id: Number(row.id),
      tweetId: row.tweet_id as string,
      accountHandle: row.account_handle as string,
      accountDisplayName: row.account_display_name as string,
      accountCategory: row.account_category as TwitterAccountCategory,
      text: row.text as string,
      createdAt: (row.created_at as Date).toISOString(),
      metrics: (row.metrics as TweetData["metrics"]) || {},
      ingestedAt: (row.ingested_at as Date).toISOString(),
    };

    if (row.sentiment_score != null) {
      tweet.signal = {
        sentimentScore: Number(row.sentiment_score),
        setupType: (row.setup_type as TweetSetupType) || null,
        confidence: Number(row.signal_confidence),
        symbolsMentioned: (row.symbols_mentioned as string[]) || [],
        reasoning: (row.reasoning as string) || "",
      };
    }

    return tweet;
  });
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
  const rows = await sql`
    SELECT
      (SELECT COUNT(*) FROM tweets) AS total_tweets,
      (SELECT COUNT(*) FROM twitter_accounts WHERE is_active = true) AS accounts,
      (SELECT COUNT(*) FROM tweets WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
      (SELECT COUNT(*) FROM tweet_signals) AS analyzed,
      (SELECT COALESCE(AVG(sentiment_score), 0) FROM tweet_signals) AS avg_sentiment
  `;

  const breakdownRows = await sql`
    SELECT setup_type, COUNT(*) AS cnt
    FROM tweet_signals
    WHERE setup_type IS NOT NULL
    GROUP BY setup_type
  `;

  const setupBreakdown: Record<string, number> = {};
  for (const r of breakdownRows) {
    setupBreakdown[r.setup_type as string] = Number(r.cnt);
  }

  const row = rows[0];
  return {
    totalTweets: Number(row?.total_tweets ?? 0),
    accounts: Number(row?.accounts ?? 0),
    last24h: Number(row?.last_24h ?? 0),
    signalStats: {
      analyzed: Number(row?.analyzed ?? 0),
      avgSentiment: Number(Number(row?.avg_sentiment ?? 0).toFixed(3)),
      setupBreakdown,
    },
  };
}
