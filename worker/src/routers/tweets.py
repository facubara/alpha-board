"""Twitter stats endpoint.

GET /twitter/stats — Aggregate tweet & signal statistics
"""

import logging

from fastapi import APIRouter
from sqlalchemy import text

from src.db import async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/twitter", tags=["twitter"])


@router.get("/stats")
async def get_twitter_stats():
    """Aggregate tweet and signal statistics."""
    async with async_session() as session:
        # Core counts
        result = await session.execute(
            text("""
                SELECT
                    (SELECT COUNT(*) FROM tweets) AS total_tweets,
                    (SELECT COUNT(*) FROM twitter_accounts WHERE is_active = true) AS accounts,
                    (SELECT COUNT(*) FROM tweets WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
                    (SELECT COUNT(*) FROM tweet_signals) AS analyzed,
                    (SELECT COALESCE(AVG(sentiment_score), 0) FROM tweet_signals) AS avg_sentiment
            """)
        )
        row = result.mappings().one()

        # Setup type breakdown
        breakdown_result = await session.execute(
            text("""
                SELECT setup_type, COUNT(*) AS cnt
                FROM tweet_signals
                WHERE setup_type IS NOT NULL
                GROUP BY setup_type
            """)
        )
        setup_breakdown = {
            r["setup_type"]: r["cnt"] for r in breakdown_result.mappings().all()
        }

        return {
            "totalTweets": row["total_tweets"],
            "accounts": row["accounts"],
            "last24h": row["last_24h"],
            "signalStats": {
                "analyzed": row["analyzed"],
                "avgSentiment": float(row["avg_sentiment"]),
                "setupBreakdown": setup_breakdown,
            },
        }
