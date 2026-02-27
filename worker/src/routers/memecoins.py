"""Memecoin analytics endpoints.

GET /memecoins/stats                              — Aggregate memecoin stats
GET /memecoins/trending?hours=24                  — Trending tokens by mention count
GET /memecoins/tokens/{symbol}/mentions?hours=72  — Recent mentions for a token
GET /memecoins/twitter/accounts/{account_id}/calls — Token calls history for an account
GET /memecoins/tracker/snapshots?ids=1,2,3        — Tracker snapshots for given token IDs
"""

import logging
from collections import defaultdict

from fastapi import APIRouter, Query
from sqlalchemy import text

from src.db import async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/memecoins", tags=["memecoins"])


# ------------------------------------------------------------------
# GET /memecoins/stats
# ------------------------------------------------------------------


@router.get("/stats")
async def get_memecoin_stats():
    """Aggregate memecoin pipeline statistics."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT
                    (SELECT COUNT(*) FROM watch_wallets WHERE is_active = true) AS wallets_tracked,
                    (SELECT COALESCE(AVG(hit_count), 0) FROM watch_wallets WHERE is_active = true) AS avg_hit_rate,
                    (SELECT COUNT(*) FROM memecoin_tweets WHERE created_at > NOW() - INTERVAL '24 hours') AS tweets_today,
                    (SELECT COUNT(*) FROM memecoin_tweet_tokens WHERE matched_at > NOW() - INTERVAL '24 hours') AS token_matches_today
            """)
        )
        row = result.mappings().one()

        return {
            "walletsTracked": row["wallets_tracked"],
            "avgHitRate": round(float(row["avg_hit_rate"]), 1),
            "tweetsToday": row["tweets_today"],
            "tokenMatchesToday": row["token_matches_today"],
        }


# ------------------------------------------------------------------
# GET /memecoins/trending
# ------------------------------------------------------------------


@router.get("/trending")
async def get_trending_tokens(hours: int = Query(default=24, ge=1, le=720)):
    """Trending memecoin tokens by mention count within the given time window."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                WITH best_mint AS (
                    SELECT DISTINCT ON (UPPER(token_symbol))
                        token_symbol, token_name, token_mint,
                        market_cap_usd, price_usd, liquidity_usd
                    FROM memecoin_tweet_tokens
                    WHERE token_mint IS NOT NULL
                    ORDER BY UPPER(token_symbol), liquidity_usd DESC NULLS LAST
                ),
                mention_counts AS (
                    SELECT
                        UPPER(token_symbol) AS symbol_key,
                        COUNT(DISTINCT tweet_id) AS mention_count
                    FROM memecoin_tweet_tokens
                    WHERE matched_at > NOW() - make_interval(hours => :hours)
                    GROUP BY UPPER(token_symbol)
                )
                SELECT
                    bm.token_symbol, bm.token_name, bm.token_mint,
                    bm.market_cap_usd, bm.price_usd, bm.liquidity_usd,
                    mc.mention_count
                FROM mention_counts mc
                JOIN best_mint bm ON UPPER(bm.token_symbol) = mc.symbol_key
                ORDER BY mc.mention_count DESC, bm.liquidity_usd DESC NULLS LAST
                LIMIT 20
            """),
            {"hours": hours},
        )
        rows = result.mappings().all()

        return [
            {
                "rank": idx + 1,
                "tokenSymbol": r["token_symbol"],
                "tokenName": r["token_name"],
                "tokenMint": r["token_mint"],
                "mentionCount": r["mention_count"],
                "marketCapUsd": float(r["market_cap_usd"]) if r["market_cap_usd"] is not None else None,
                "priceUsd": float(r["price_usd"]) if r["price_usd"] is not None else None,
                "liquidityUsd": float(r["liquidity_usd"]) if r["liquidity_usd"] is not None else None,
                "birdeyeUrl": f"https://birdeye.so/token/{r['token_mint']}" if r["token_mint"] else None,
            }
            for idx, r in enumerate(rows)
        ]


# ------------------------------------------------------------------
# GET /memecoins/tokens/{symbol}/mentions
# ------------------------------------------------------------------


@router.get("/tokens/{symbol}/mentions")
async def get_token_mentions(symbol: str, hours: int = Query(default=72, ge=1, le=720)):
    """Recent tweet mentions for a specific token symbol."""
    async with async_session() as session:
        result = await session.execute(
            text("""
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
                WHERE UPPER(mtt.token_symbol) = UPPER(:symbol)
                  AND mt.created_at > NOW() - make_interval(hours => :hours)
                ORDER BY mt.created_at DESC
                LIMIT 50
            """),
            {"symbol": symbol, "hours": hours},
        )
        rows = result.mappings().all()

        return [
            {
                "tweetId": r["tweet_id"],
                "tweetText": r["tweet_text"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
                "accountHandle": r["account_handle"],
                "accountDisplayName": r["account_display_name"],
                "accountCategory": r["account_category"],
                "isVip": r["is_vip"],
                "source": r["source"],
            }
            for r in rows
        ]


# ------------------------------------------------------------------
# GET /memecoins/twitter/accounts/{account_id}/calls
# ------------------------------------------------------------------


@router.get("/twitter/accounts/{account_id}/calls")
async def get_account_calls(account_id: int):
    """Token call history for a specific memecoin twitter account."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                WITH account_tokens AS (
                    SELECT
                        mtt.token_mint, mtt.token_symbol, mtt.token_name,
                        mtt.matched_at, mtt.market_cap_usd, mtt.price_usd,
                        ROW_NUMBER() OVER (PARTITION BY mtt.token_mint ORDER BY mtt.matched_at ASC) AS rn,
                        COUNT(*) OVER (PARTITION BY mtt.token_mint) AS mention_count
                    FROM memecoin_tweet_tokens mtt
                    JOIN memecoin_tweets mt ON mt.id = mtt.tweet_id
                    WHERE mt.account_id = :account_id
                      AND mtt.token_mint IS NOT NULL
                ),
                ath_data AS (
                    SELECT token_mint, MAX(market_cap_usd) AS ath_mcap
                    FROM memecoin_tweet_tokens
                    WHERE token_mint IS NOT NULL AND market_cap_usd IS NOT NULL
                    GROUP BY token_mint
                )
                SELECT
                    at.token_mint, at.token_symbol, at.token_name,
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
            """),
            {"account_id": account_id},
        )
        rows = result.mappings().all()

        return [
            {
                "tokenMint": r["token_mint"],
                "tokenSymbol": r["token_symbol"],
                "tokenName": r["token_name"],
                "firstMentionedAt": r["first_mentioned_at"].isoformat() if r["first_mentioned_at"] else None,
                "mentionCount": r["mention_count"],
                "matchTimeMcap": float(r["match_time_mcap"]) if r["match_time_mcap"] is not None else None,
                "matchTimePrice": float(r["match_time_price"]) if r["match_time_price"] is not None else None,
                "athMcap": float(r["ath_mcap"]) if r["ath_mcap"] is not None else None,
            }
            for r in rows
        ]


# ------------------------------------------------------------------
# GET /memecoins/tracker/snapshots
# ------------------------------------------------------------------


@router.get("/tracker/snapshots")
async def get_tracker_snapshots(ids: str = Query(..., description="Comma-separated token IDs")):
    """Token tracker snapshots for the last 7 days, grouped by token_id."""
    token_ids = [int(i.strip()) for i in ids.split(",") if i.strip().isdigit()]
    if not token_ids:
        return {}

    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT id, token_id, holders, price_usd, volume_24h_usd, mcap_usd, snapshot_at
                FROM token_tracker_snapshots
                WHERE token_id = ANY(:ids)
                  AND snapshot_at > NOW() - INTERVAL '7 days'
                ORDER BY token_id, snapshot_at ASC
            """),
            {"ids": token_ids},
        )
        rows = result.mappings().all()

        grouped: dict[str, list] = defaultdict(list)
        for r in rows:
            grouped[str(r["token_id"])].append({
                "id": r["id"],
                "tokenId": r["token_id"],
                "holders": r["holders"],
                "priceUsd": float(r["price_usd"]) if r["price_usd"] is not None else None,
                "volume24hUsd": float(r["volume_24h_usd"]) if r["volume_24h_usd"] is not None else None,
                "mcapUsd": float(r["mcap_usd"]) if r["mcap_usd"] is not None else None,
                "snapshotAt": r["snapshot_at"].isoformat() if r["snapshot_at"] else None,
            })

        return dict(grouped)
