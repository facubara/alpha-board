"""Memecoin Twitter poller — ingests tweets from memecoin-focused accounts.

Mirrors the main TwitterPoller but operates on separate tables:
memecoin_twitter_accounts and memecoin_tweets.
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.events import event_bus
from src.llm_settings import is_enabled
from src.models.db import (
    MemecoinTweet,
    MemecoinTweetSignal,
    MemecoinTwitterAccount,
)
from src.twitter.client import TwitterClient
from src.memecoins.token_extractor import TokenExtractor
from src.memecoins.vip_analyzer import VipTokenAnalyzer

logger = logging.getLogger(__name__)


class MemecoinTwitterPoller:
    """Polls X API for new tweets from memecoin-tracked accounts."""

    def __init__(
        self, session: AsyncSession, client: TwitterClient | None = None
    ):
        self.session = session
        self.client = client or TwitterClient()
        self.extractor = TokenExtractor()
        self.vip_analyzer = VipTokenAnalyzer()

    async def poll(self) -> dict:
        """Run a single poll cycle.

        Returns:
            Summary dict with new_tweets, token_matches, errors.
        """
        errors: list[str] = []

        # 1. Fetch active accounts
        result = await self.session.execute(
            select(MemecoinTwitterAccount).where(
                MemecoinTwitterAccount.is_active == True  # noqa: E712
            )
        )
        accounts = list(result.scalars().all())

        if not accounts:
            return {"new_tweets": 0, "accounts_polled": 0, "errors": []}

        handle_to_account = {a.handle.lower(): a for a in accounts}
        handles = list(handle_to_account.keys())

        # 2. Get since_id (most recent tweet_id)
        since_result = await self.session.execute(
            select(MemecoinTweet.tweet_id)
            .order_by(MemecoinTweet.created_at.desc())
            .limit(1)
        )
        since_id = since_result.scalar_one_or_none()

        # 3. Search for new tweets (reuses existing TwitterClient)
        try:
            raw_tweets = await self.client.search_recent(handles, since_id=since_id)
        except Exception as e:
            logger.exception(f"Memecoin Twitter poll failed: {e}")
            return {
                "new_tweets": 0,
                "accounts_polled": len(accounts),
                "errors": [str(e)],
            }

        # 4. Persist new tweets
        new_count = 0
        new_tweet_ids: list[int] = []  # DB IDs of newly inserted tweets
        new_tweet_data: list[dict] = []  # For SSE broadcast

        for tweet_data in raw_tweets:
            author_handle = tweet_data.get("author_handle", "").lower()
            account = handle_to_account.get(author_handle)
            if not account:
                continue

            metrics = tweet_data.get("metrics", {})
            media_urls = tweet_data.get("media_urls", [])
            if media_urls:
                metrics["media_urls"] = media_urls

            stmt = (
                pg_insert(MemecoinTweet)
                .values(
                    account_id=account.id,
                    tweet_id=tweet_data["tweet_id"],
                    text=tweet_data["text"],
                    created_at=tweet_data["created_at"],
                    metrics=metrics,
                )
                .on_conflict_do_nothing(index_elements=["tweet_id"])
                .returning(MemecoinTweet.id)
            )

            result = await self.session.execute(stmt)
            row = result.first()
            if row:
                new_count += 1
                db_id = row[0]
                new_tweet_ids.append(db_id)
                new_tweet_data.append({
                    "db_id": db_id,
                    "text": tweet_data["text"],
                    "account": account,
                    "tweet_data": tweet_data,
                })

        await self.session.commit()

        # 5. Run token extraction on new tweets
        token_match_count = 0
        for item in new_tweet_data:
            try:
                matches = await self.extractor.extract_and_match(
                    self.session, item["db_id"], item["text"]
                )
                token_match_count += len(matches)
            except Exception as e:
                logger.warning(f"Token extraction failed: {e}")
                errors.append(f"extraction: {e}")

        # 6. Run VIP LLM analysis on VIP account tweets
        vip_match_count = 0
        for item in new_tweet_data:
            account = item["account"]
            if not account.is_vip:
                continue
            try:
                matches = await self.vip_analyzer.analyze_tweet(
                    self.session,
                    item["db_id"],
                    item["text"],
                    account.handle,
                )
                vip_match_count += len(matches)
            except Exception as e:
                logger.warning(f"VIP analysis failed for @{account.handle}: {e}")
                errors.append(f"vip: {e}")

        # 7. Run sentiment analysis on all new tweets
        analysis_count = 0
        if (
            settings.tweet_analysis_enabled
            and is_enabled("memecoin_tweet_sentiment")
            and new_count > 0
        ):
            try:
                analysis_count = await self._analyze_sentiment(new_tweet_data)
            except Exception as e:
                logger.warning(f"Memecoin sentiment analysis failed: {e}")
                errors.append(f"sentiment: {e}")

        await self.session.commit()

        # 8. Broadcast via SSE
        if new_count > 0:
            broadcast = []
            for item in new_tweet_data:
                account = item["account"]
                td = item["tweet_data"]
                broadcast.append({
                    "id": item["db_id"],
                    "tweetId": td["tweet_id"],
                    "accountHandle": account.handle,
                    "accountDisplayName": account.display_name,
                    "accountCategory": account.category,
                    "isVip": account.is_vip,
                    "text": td["text"],
                    "createdAt": td["created_at"],
                    "metrics": td.get("metrics", {}),
                })

            await event_bus.publish("memecoins", {
                "type": "tweet_update",
                "tweets": broadcast,
            })

        summary = {
            "new_tweets": new_count,
            "accounts_polled": len(accounts),
            "token_matches": token_match_count,
            "vip_matches": vip_match_count,
            "analyzed": analysis_count,
            "errors": errors,
        }
        logger.info(f"Memecoin Twitter poll: {summary}")
        return summary

    async def _analyze_sentiment(self, tweet_items: list[dict]) -> int:
        """Run sentiment analysis on new tweets using same pattern as TweetAnalyzer."""
        if not settings.anthropic_api_key:
            return 0

        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        model = settings.tweet_analysis_model

        # Build numbered tweet list
        tweet_lines = []
        tweet_map: dict[int, dict] = {}
        for idx, item in enumerate(tweet_items, 1):
            account = item["account"]
            td = item["tweet_data"]
            metrics = td.get("metrics", {})
            likes = metrics.get("like_count", 0)
            rts = metrics.get("retweet_count", 0)
            tweet_lines.append(
                f"[{idx}] @{account.handle} ({account.category}) "
                f"[likes:{likes}, RTs:{rts}]\n{td['text']}"
            )
            tweet_map[idx] = item

        if not tweet_lines:
            return 0

        user_message = "Analyze the following memecoin tweets:\n\n" + "\n\n".join(
            tweet_lines
        )

        from src.twitter.analyzer import ANALYZE_TWEETS_TOOL, SYSTEM_PROMPT, MODEL_PRICING

        try:
            response = client.messages.create(
                model=model,
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                tools=[ANALYZE_TWEETS_TOOL],
                tool_choice={"type": "tool", "name": "analyze_tweets"},
                messages=[{"role": "user", "content": user_message}],
            )
        except Exception as e:
            logger.warning(f"Sentiment API call failed: {e}")
            return 0

        # Calculate cost
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        pricing = MODEL_PRICING.get(model, {"input": 1.0, "output": 5.0})
        cost = (
            input_tokens * pricing["input"] + output_tokens * pricing["output"]
        ) / 1_000_000

        # Parse response
        analyses = []
        for block in response.content:
            if block.type == "tool_use" and block.name == "analyze_tweets":
                analyses = block.input.get("analyses", [])
                break

        analyzed = 0
        batch_size = len(tweet_items) or 1
        for analysis in analyses:
            tweet_num = analysis.get("tweet_number")
            item = tweet_map.get(tweet_num)
            if not item:
                continue

            signal = MemecoinTweetSignal(
                tweet_id=item["db_id"],
                sentiment_score=Decimal(
                    str(round(analysis["sentiment_score"], 3))
                ),
                setup_type=analysis.get("setup_type"),
                confidence=Decimal(str(round(analysis.get("confidence", 0.5), 3))),
                symbols_mentioned=analysis.get("symbols_mentioned", []),
                reasoning=analysis.get("reasoning", ""),
                model_used=model,
                input_tokens=input_tokens // batch_size,
                output_tokens=output_tokens // batch_size,
                estimated_cost_usd=Decimal(str(round(cost / batch_size, 4))),
            )
            self.session.add(signal)
            analyzed += 1

        return analyzed


async def run_memecoin_twitter_poll() -> dict:
    """Entry point for scheduler job."""
    from src.db import async_session
    from src.llm_settings import load_llm_settings

    async with async_session() as session:
        await load_llm_settings(session)
        poller = MemecoinTwitterPoller(session)
        return await poller.poll()
