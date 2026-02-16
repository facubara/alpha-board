"""Tweet sentiment analyzer — LLM-powered analysis of crypto tweets.

Uses Claude Haiku to batch-analyze tweets for sentiment, setup types,
and trading signals. Results are persisted to tweet_signals table.
"""

import logging
from decimal import Decimal

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.db import Tweet, TweetSignal, TwitterAccount

logger = logging.getLogger(__name__)

# Pricing per 1M tokens
MODEL_PRICING = {
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.00},
    "claude-haiku-3-5-20241022": {"input": 1.00, "output": 5.00},
    "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00},
}

BATCH_SIZE = 15

ANALYZE_TWEETS_TOOL = {
    "name": "analyze_tweets",
    "description": "Analyze crypto tweets for sentiment and trading signals",
    "input_schema": {
        "type": "object",
        "properties": {
            "analyses": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "tweet_number": {"type": "integer"},
                        "sentiment_score": {
                            "type": "number",
                            "minimum": -1,
                            "maximum": 1,
                        },
                        "setup_type": {
                            "type": "string",
                            "enum": [
                                "long_entry",
                                "short_entry",
                                "take_profit",
                                "warning",
                                "neutral",
                                "informational",
                            ],
                        },
                        "confidence": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                        },
                        "symbols_mentioned": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "reasoning": {"type": "string"},
                    },
                    "required": [
                        "tweet_number",
                        "sentiment_score",
                        "setup_type",
                        "confidence",
                        "symbols_mentioned",
                        "reasoning",
                    ],
                },
            },
        },
        "required": ["analyses"],
    },
}

SYSTEM_PROMPT = """You are a crypto market sentiment analyst. You analyze tweets from crypto traders, analysts, and influencers to extract trading sentiment and signals.

For each tweet, determine:
1. **sentiment_score**: -1.000 (extremely bearish) to +1.000 (extremely bullish). 0 = neutral.
2. **setup_type**: The most relevant classification:
   - "long_entry" — tweet suggests buying / going long
   - "short_entry" — tweet suggests selling / going short
   - "take_profit" — tweet suggests taking profits on existing positions
   - "warning" — tweet warns about risk, potential crash, or danger
   - "neutral" — tweet is market commentary without clear direction
   - "informational" — tweet shares data, news, or updates without opinion
3. **confidence**: 0.0 to 1.0 — how confident you are in your sentiment assessment
4. **symbols_mentioned**: Array of ticker symbols mentioned (e.g. ["BTC", "ETH"]). Use standard symbols without USDT suffix.
5. **reasoning**: Brief 1-sentence explanation of your assessment.

Consider: the author's category (analyst, founder, degen, etc.), engagement metrics, and the actual content/tone of the tweet."""


class TweetAnalyzer:
    """Batch-analyzes tweets for sentiment using Claude."""

    def __init__(self, api_key: str | None = None):
        self.client = anthropic.Anthropic(
            api_key=api_key or settings.anthropic_api_key
        )
        self.model = settings.tweet_analysis_model

    async def analyze_batch(self, session: AsyncSession) -> dict:
        """Analyze all unanalyzed tweets in batches.

        Returns:
            Summary dict with analyzed count, errors, and cost.
        """
        # Query tweets without signals
        result = await session.execute(
            select(Tweet, TwitterAccount)
            .join(TwitterAccount, TwitterAccount.id == Tweet.twitter_account_id)
            .outerjoin(TweetSignal, TweetSignal.tweet_id == Tweet.id)
            .where(TweetSignal.id == None)  # noqa: E711
            .order_by(Tweet.created_at.desc())
            .limit(BATCH_SIZE * 10)  # Cap at 150 tweets per run
        )
        rows = list(result.all())

        if not rows:
            return {"analyzed": 0, "errors": 0, "cost": 0.0}

        total_analyzed = 0
        total_errors = 0
        total_cost = 0.0

        # Process in batches
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i : i + BATCH_SIZE]
            try:
                batch_result = await self._analyze_single_batch(session, batch)
                total_analyzed += batch_result["analyzed"]
                total_cost += batch_result["cost"]
            except Exception as e:
                logger.exception(f"Batch analysis failed: {e}")
                total_errors += len(batch)

        await session.commit()

        summary = {
            "analyzed": total_analyzed,
            "errors": total_errors,
            "cost": round(total_cost, 4),
        }
        logger.info(f"Tweet analysis: {summary}")
        return summary

    async def _analyze_single_batch(
        self, session: AsyncSession, batch: list[tuple[Tweet, TwitterAccount]]
    ) -> dict:
        """Analyze a single batch of tweets."""
        # Build numbered tweet list for prompt
        tweet_map: dict[int, Tweet] = {}
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

        user_message = "Analyze the following tweets:\n\n" + "\n\n".join(tweet_lines)

        # Call Claude
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=[ANALYZE_TWEETS_TOOL],
            tool_choice={"type": "tool", "name": "analyze_tweets"},
            messages=[{"role": "user", "content": user_message}],
        )

        # Calculate cost
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        pricing = MODEL_PRICING.get(self.model, {"input": 1.0, "output": 5.0})
        cost = (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000

        # Parse tool_use response
        analyses = self._parse_response(response)

        analyzed = 0
        for analysis in analyses:
            tweet_num = analysis.get("tweet_number")
            tweet = tweet_map.get(tweet_num)
            if not tweet:
                continue

            signal = TweetSignal(
                tweet_id=tweet.id,
                sentiment_score=Decimal(str(round(analysis["sentiment_score"], 3))),
                setup_type=analysis["setup_type"],
                confidence=Decimal(str(round(analysis["confidence"], 3))),
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

    def _parse_response(self, response) -> list[dict]:
        """Parse tool_use response into analysis dicts."""
        for block in response.content:
            if block.type == "tool_use" and block.name == "analyze_tweets":
                return block.input.get("analyses", [])
        logger.warning("No analyze_tweets tool_use block found in response")
        return []
