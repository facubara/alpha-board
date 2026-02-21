/**
 * Memecoin Queries
 *
 * Fetches watch wallets, activity, memecoin tweets, and token matches.
 */

import { sql } from "@/lib/db";
import type {
  WatchWallet,
  WalletActivity,
  MemecoinTwitterAccount,
  MemecoinCategory,
  MemecoinTweetData,
  MemecoinTokenMatch,
  MemecoinStats,
  TweetSetupType,
} from "@/lib/types";

/**
 * Fetch watch wallets sorted by score.
 */
export async function getWatchWallets(): Promise<WatchWallet[]> {
  const rows = await sql`
    SELECT *
    FROM watch_wallets
    WHERE is_active = true
    ORDER BY score DESC
    LIMIT 100
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    address: row.address as string,
    label: (row.label as string) || null,
    source: row.source as string,
    score: Number(row.score),
    hitCount: Number(row.hit_count),
    winRate: row.win_rate != null ? Number(row.win_rate) : null,
    avgEntryRank: row.avg_entry_rank != null ? Number(row.avg_entry_rank) : null,
    totalTokensTraded: Number(row.total_tokens_traded),
    tokensSummary: (row.tokens_summary as WatchWallet["tokensSummary"]) || [],
    isActive: row.is_active as boolean,
    stats: (row.stats as Record<string, unknown>) || {},
    addedAt: (row.added_at as Date).toISOString(),
    lastRefreshedAt: row.last_refreshed_at
      ? (row.last_refreshed_at as Date).toISOString()
      : null,
  }));
}

/**
 * Fetch recent wallet activity.
 */
export async function getRecentWalletActivity(
  limit: number = 50
): Promise<WalletActivity[]> {
  const rows = await sql`
    SELECT
      a.id,
      a.wallet_id,
      w.address AS wallet_address,
      w.label AS wallet_label,
      a.token_mint,
      a.token_symbol,
      a.token_name,
      a.direction,
      a.amount_sol,
      a.price_usd,
      a.tx_signature,
      a.block_time,
      a.detected_at
    FROM watch_wallet_activity a
    JOIN watch_wallets w ON w.id = a.wallet_id
    ORDER BY a.detected_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    walletId: Number(row.wallet_id),
    walletAddress: row.wallet_address as string,
    walletLabel: (row.wallet_label as string) || null,
    tokenMint: row.token_mint as string,
    tokenSymbol: (row.token_symbol as string) || null,
    tokenName: (row.token_name as string) || null,
    direction: row.direction as "buy" | "sell",
    amountSol: row.amount_sol != null ? Number(row.amount_sol) : null,
    priceUsd: row.price_usd != null ? Number(row.price_usd) : null,
    txSignature: row.tx_signature as string,
    blockTime: (row.block_time as Date).toISOString(),
    detectedAt: (row.detected_at as Date).toISOString(),
  }));
}

/**
 * Fetch memecoin twitter accounts with tweet counts.
 */
export async function getMemecoinTwitterAccounts(): Promise<
  MemecoinTwitterAccount[]
> {
  const rows = await sql`
    SELECT
      mta.id,
      mta.handle,
      mta.display_name,
      mta.category,
      mta.is_vip,
      mta.is_active,
      mta.added_at,
      COUNT(mt.id) AS tweet_count
    FROM memecoin_twitter_accounts mta
    LEFT JOIN memecoin_tweets mt ON mt.account_id = mta.id
    GROUP BY mta.id
    ORDER BY mta.added_at DESC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    handle: row.handle as string,
    displayName: row.display_name as string,
    category: row.category as MemecoinCategory,
    isVip: row.is_vip as boolean,
    isActive: row.is_active as boolean,
    addedAt: (row.added_at as Date).toISOString(),
    tweetCount: Number(row.tweet_count),
  }));
}

/**
 * Fetch recent memecoin tweets with signals and token matches.
 */
export async function getRecentMemecoinTweets(
  limit: number = 50
): Promise<MemecoinTweetData[]> {
  const rows = await sql`
    SELECT
      mt.id,
      mt.tweet_id,
      mt.text,
      mt.created_at,
      mt.metrics,
      mt.ingested_at,
      mta.handle AS account_handle,
      mta.display_name AS account_display_name,
      mta.category AS account_category,
      mta.is_vip,
      ms.sentiment_score,
      ms.setup_type,
      ms.confidence AS signal_confidence,
      ms.symbols_mentioned,
      ms.reasoning
    FROM memecoin_tweets mt
    JOIN memecoin_twitter_accounts mta ON mta.id = mt.account_id
    LEFT JOIN memecoin_tweet_signals ms ON ms.tweet_id = mt.id
    ORDER BY mt.created_at DESC
    LIMIT ${limit}
  `;

  // Fetch all token matches for these tweets in one query
  const tweetIds = rows.map((r) => Number(r.id));
  let tokenMatchMap: Map<number, MemecoinTokenMatch[]> = new Map();

  if (tweetIds.length > 0) {
    const tokenRows = await sql`
      SELECT *
      FROM memecoin_tweet_tokens
      WHERE tweet_id = ANY(${tweetIds})
      ORDER BY matched_at DESC
    `;

    for (const tr of tokenRows) {
      const tweetId = Number(tr.tweet_id);
      const match: MemecoinTokenMatch = {
        id: Number(tr.id),
        tokenMint: (tr.token_mint as string) || null,
        tokenSymbol: tr.token_symbol as string,
        tokenName: (tr.token_name as string) || null,
        source: tr.source as "keyword" | "llm",
        dexscreenerUrl: (tr.dexscreener_url as string) || null,
        marketCapUsd:
          tr.market_cap_usd != null ? Number(tr.market_cap_usd) : null,
        priceUsd: tr.price_usd != null ? Number(tr.price_usd) : null,
        liquidityUsd:
          tr.liquidity_usd != null ? Number(tr.liquidity_usd) : null,
        matchedAt: (tr.matched_at as Date).toISOString(),
      };

      if (!tokenMatchMap.has(tweetId)) {
        tokenMatchMap.set(tweetId, []);
      }
      tokenMatchMap.get(tweetId)!.push(match);
    }
  }

  return rows.map((row) => {
    const tweet: MemecoinTweetData = {
      id: Number(row.id),
      tweetId: row.tweet_id as string,
      accountHandle: row.account_handle as string,
      accountDisplayName: row.account_display_name as string,
      accountCategory: row.account_category as MemecoinCategory,
      isVip: row.is_vip as boolean,
      text: row.text as string,
      createdAt: (row.created_at as Date).toISOString(),
      metrics: (row.metrics as MemecoinTweetData["metrics"]) || {},
      ingestedAt: (row.ingested_at as Date).toISOString(),
      tokenMatches: tokenMatchMap.get(Number(row.id)) || [],
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
 * Get memecoin dashboard stats.
 */
export async function getMemecoinStats(): Promise<MemecoinStats> {
  const rows = await sql`
    SELECT
      (SELECT COUNT(*) FROM watch_wallets WHERE is_active = true) AS wallets_tracked,
      (SELECT COALESCE(AVG(hit_count), 0) FROM watch_wallets WHERE is_active = true) AS avg_hit_rate,
      (SELECT COUNT(*) FROM memecoin_tweets WHERE created_at > NOW() - INTERVAL '24 hours') AS tweets_today,
      (SELECT COUNT(*) FROM memecoin_tweet_tokens WHERE matched_at > NOW() - INTERVAL '24 hours') AS token_matches_today
  `;

  const row = rows[0];
  return {
    walletsTracked: Number(row?.wallets_tracked ?? 0),
    avgHitRate: Number(Number(row?.avg_hit_rate ?? 0).toFixed(1)),
    tweetsToday: Number(row?.tweets_today ?? 0),
    tokenMatchesToday: Number(row?.token_matches_today ?? 0),
  };
}
