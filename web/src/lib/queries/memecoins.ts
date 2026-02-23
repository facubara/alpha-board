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
  TrendingToken,
  TokenMention,
  AccountCallHistoryItem,
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

/**
 * Get trending tokens by mention count in the last N hours.
 * Deduplicates copies by picking the highest-liquidity mint per symbol.
 */
export async function getTrendingTokens(
  hours: number = 24
): Promise<TrendingToken[]> {
  const rows = await sql`
    WITH best_mint AS (
      SELECT DISTINCT ON (UPPER(token_symbol))
        token_symbol,
        token_name,
        token_mint,
        market_cap_usd,
        price_usd,
        liquidity_usd
      FROM memecoin_tweet_tokens
      WHERE token_mint IS NOT NULL
      ORDER BY UPPER(token_symbol), liquidity_usd DESC NULLS LAST
    ),
    mention_counts AS (
      SELECT
        UPPER(token_symbol) AS symbol_key,
        COUNT(DISTINCT tweet_id) AS mention_count
      FROM memecoin_tweet_tokens
      WHERE matched_at > NOW() - make_interval(hours => ${hours})
      GROUP BY UPPER(token_symbol)
    )
    SELECT
      bm.token_symbol,
      bm.token_name,
      bm.token_mint,
      bm.market_cap_usd,
      bm.price_usd,
      bm.liquidity_usd,
      mc.mention_count
    FROM mention_counts mc
    JOIN best_mint bm ON UPPER(bm.token_symbol) = mc.symbol_key
    ORDER BY mc.mention_count DESC, bm.liquidity_usd DESC NULLS LAST
    LIMIT 20
  `;

  return rows.map((row, i) => ({
    rank: i + 1,
    tokenSymbol: row.token_symbol as string,
    tokenName: (row.token_name as string) || null,
    tokenMint: row.token_mint as string,
    mentionCount: Number(row.mention_count),
    marketCapUsd:
      row.market_cap_usd != null ? Number(row.market_cap_usd) : null,
    priceUsd: row.price_usd != null ? Number(row.price_usd) : null,
    liquidityUsd:
      row.liquidity_usd != null ? Number(row.liquidity_usd) : null,
    birdeyeUrl: `https://birdeye.so/token/${row.token_mint}?chain=solana`,
  }));
}

/**
 * Get tweets mentioning a specific token symbol within a time window.
 */
export async function getTweetsByToken(
  tokenSymbol: string,
  hours: number = 72
): Promise<TokenMention[]> {
  const rows = await sql`
    SELECT
      mt.tweet_id,
      mt.text AS tweet_text,
      mt.created_at,
      mta.handle AS account_handle,
      mta.display_name AS account_display_name,
      mta.category AS account_category,
      mta.is_vip,
      mtt.source
    FROM memecoin_tweet_tokens mtt
    JOIN memecoin_tweets mt ON mt.id = mtt.tweet_id
    JOIN memecoin_twitter_accounts mta ON mta.id = mt.account_id
    WHERE UPPER(mtt.token_symbol) = UPPER(${tokenSymbol})
      AND mt.created_at > NOW() - make_interval(hours => ${hours})
    ORDER BY mt.created_at DESC
    LIMIT 50
  `;

  return rows.map((row) => ({
    tweetId: row.tweet_id as string,
    tweetText: row.tweet_text as string,
    createdAt: (row.created_at as Date).toISOString(),
    accountHandle: row.account_handle as string,
    accountDisplayName: row.account_display_name as string,
    accountCategory: row.account_category as MemecoinCategory,
    isVip: row.is_vip as boolean,
    source: row.source as "keyword" | "llm",
  }));
}

/**
 * Get call history for a specific account — tokens they mentioned, with ATH data.
 */
export async function getAccountCallHistory(
  accountId: number
): Promise<AccountCallHistoryItem[]> {
  const rows = await sql`
    WITH account_tokens AS (
      SELECT
        mtt.token_mint,
        mtt.token_symbol,
        mtt.token_name,
        mtt.matched_at,
        mtt.market_cap_usd,
        mtt.price_usd,
        ROW_NUMBER() OVER (PARTITION BY mtt.token_mint ORDER BY mtt.matched_at ASC) AS rn,
        COUNT(*) OVER (PARTITION BY mtt.token_mint) AS mention_count
      FROM memecoin_tweet_tokens mtt
      JOIN memecoin_tweets mt ON mt.id = mtt.tweet_id
      WHERE mt.account_id = ${accountId}
        AND mtt.token_mint IS NOT NULL
    ),
    ath_data AS (
      SELECT
        token_mint,
        MAX(market_cap_usd) AS ath_mcap
      FROM memecoin_tweet_tokens
      WHERE token_mint IS NOT NULL
        AND market_cap_usd IS NOT NULL
      GROUP BY token_mint
    )
    SELECT
      at.token_mint,
      at.token_symbol,
      at.token_name,
      at.matched_at AS first_mentioned_at,
      at.mention_count,
      at.market_cap_usd AS match_time_mcap,
      at.price_usd AS match_time_price,
      ad.ath_mcap
    FROM account_tokens at
    LEFT JOIN ath_data ad ON ad.token_mint = at.token_mint
    WHERE at.rn = 1
    ORDER BY at.matched_at DESC
    LIMIT 50
  `;

  return rows.map((row) => ({
    tokenMint: row.token_mint as string,
    tokenSymbol: row.token_symbol as string,
    tokenName: (row.token_name as string) || null,
    firstMentionedAt: (row.first_mentioned_at as Date).toISOString(),
    mentionCount: Number(row.mention_count),
    matchTimeMcap: row.match_time_mcap != null ? Number(row.match_time_mcap) : null,
    matchTimePrice: row.match_time_price != null ? Number(row.match_time_price) : null,
    athMcap: row.ath_mcap != null ? Number(row.ath_mcap) : null,
  }));
}
