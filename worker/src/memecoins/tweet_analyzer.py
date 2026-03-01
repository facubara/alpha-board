"""Memecoin tweet sentiment analyzer — batch analysis using Claude.

Mirrors TweetAnalyzer but operates on memecoin_tweets / memecoin_tweet_signals tables.
"""

import logging
from collections.abc import Awaitable, Callable
from decimal import Decimal

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.db import MemecoinTweet, MemecoinTweetSignal, MemecoinTwitterAccount
from src.twitter.analyzer import ANALYZE_TWEETS_TOOL, MODEL_PRICING, SYSTEM_PROMPT

logger = logging.getLogger(__name__)

BATCH_SIZE = 15


class MemecoinTweetAnalyzer:
    """Batch-analyzes memecoin tweets for sentiment using Claude."""

    def __init__(self, api_key: str | None = None):
        self.client = anthropic.Anthropic(
            api_key=api_key or settings.anthropic_api_key
        )
        self.model = settings.tweet_analysis_model

    async def analyze_batch(
        self,
        session: AsyncSession,
        on_batch_done: Callable[[int, int], Awaitable[None]] | None = None,
    ) -> dict:
        """Analyze all unanalyzed memecoin tweets in batches."""
        result = await session.execute(
            select(MemecoinTweet, MemecoinTwitterAccount)
            .join(MemecoinTwitterAccount, MemecoinTwitterAccount.id == MemecoinTweet.account_id)
            .outerjoin(MemecoinTweetSignal, MemecoinTweetSignal.tweet_id == MemecoinTweet.id)
            .where(MemecoinTweetSignal.id == None)  # noqa: E711
            .order_by(MemecoinTweet.created_at.desc())
            .limit(BATCH_SIZE * 10)
        )
        rows = list(result.all())

        if not rows:
            return {"analyzed": 0, "errors": 0, "cost": 0.0, "total_items": 0}

        total_analyzed = 0
        total_errors = 0
        total_cost = 0.0

        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i : i + BATCH_SIZE]
            try:
                batch_result = await self._analyze_single_batch(session, batch)
                total_analyzed += batch_result["analyzed"]
                total_cost += batch_result["cost"]
            except Exception as e:
                logger.exception(f"Memecoin batch analysis failed: {e}")
                total_errors += len(batch)

            if on_batch_done:
                await on_batch_done(total_analyzed, total_errors)

        await session.commit()

        summary = {
            "analyzed": total_analyzed,
            "errors": total_errors,
            "cost": round(total_cost, 4),
            "total_items": len(rows),
        }
        logger.info(f"Memecoin tweet analysis: {summary}")
        return summary

    async def _analyze_single_batch(
        self,
        session: AsyncSession,
        batch: list[tuple[MemecoinTweet, MemecoinTwitterAccount]],
    ) -> dict:
        """Analyze a single batch of memecoin tweets."""
        tweet_map: dict[int, MemecoinTweet] = {}
        tweet_lines = []
        for idx, (tweet, account) in enumerate(batch, 1):
            tweet_map[idx] = tweet
            metrics = tweet.metrics or {}
            likes = metrics.get("like_count", 0)
            rts = metrics.get("retweet_count", 0)
            tweet_lines.append(
                f"[{idx}] @{account.handle} ({account.category}) "
                f"[likes:{likes}, RTs:{rts}]\n{tweet.text}"
            )

        user_message = "Analyze the following memecoin tweets:\n\n" + "\n\n".join(
            tweet_lines
        )

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=[ANALYZE_TWEETS_TOOL],
            tool_choice={"type": "tool", "name": "analyze_tweets"},
            messages=[{"role": "user", "content": user_message}],
        )

        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        pricing = MODEL_PRICING.get(self.model, {"input": 1.0, "output": 5.0})
        cost = (
            input_tokens * pricing["input"] + output_tokens * pricing["output"]
        ) / 1_000_000

        analyses = []
        for block in response.content:
            if block.type == "tool_use" and block.name == "analyze_tweets":
                analyses = block.input.get("analyses", [])
                break

        analyzed = 0
        for analysis in analyses:
            tweet_num = analysis.get("tweet_number")
            tweet = tweet_map.get(tweet_num)
            if not tweet:
                continue

            signal = MemecoinTweetSignal(
                tweet_id=tweet.id,
                sentiment_score=Decimal(str(round(analysis["sentiment_score"], 3))),
                setup_type=analysis.get("setup_type"),
                confidence=Decimal(str(round(analysis.get("confidence", 0.5), 3))),
                symbols_mentioned=analysis.get("symbols_mentioned", []),
                reasoning=analysis.get("reasoning", ""),
                model_used=self.model,
                input_tokens=input_tokens // len(batch),
                output_tokens=output_tokens // len(batch),
                estimated_cost_usd=Decimal(str(round(cost / len(batch), 4))),
            )
            session.add(signal)
            analyzed += 1

        return {"analyzed": analyzed, "cost": cost}
