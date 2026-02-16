"""Twitter poller — scheduled job that ingests tweets from tracked accounts."""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.events import event_bus
from src.models.db import Tweet, TwitterAccount
from src.twitter.client import TwitterClient

logger = logging.getLogger(__name__)


class TwitterPoller:
    """Polls X API for new tweets from tracked accounts and persists them."""

    def __init__(self, session: AsyncSession, client: TwitterClient | None = None):
        self.session = session
        self.client = client or TwitterClient()

    async def poll(self) -> dict:
        """Run a single poll cycle.

        Returns:
            Summary dict with new_tweets, accounts_polled, errors.
        """
        errors: list[str] = []

        # 1. Fetch active accounts
        result = await self.session.execute(
            select(TwitterAccount).where(TwitterAccount.is_active == True)  # noqa: E712
        )
        accounts = list(result.scalars().all())

        if not accounts:
            return {"new_tweets": 0, "accounts_polled": 0, "errors": []}

        handle_to_account = {a.handle.lower(): a for a in accounts}
        handles = list(handle_to_account.keys())

        # 2. Get since_id (most recent tweet_id we have)
        since_result = await self.session.execute(
            select(Tweet.tweet_id).order_by(Tweet.created_at.desc()).limit(1)
        )
        since_id = since_result.scalar_one_or_none()

        # 3. Search for new tweets
        try:
            raw_tweets = await self.client.search_recent(handles, since_id=since_id)
        except Exception as e:
            logger.exception(f"Twitter poll failed: {e}")
            return {"new_tweets": 0, "accounts_polled": len(accounts), "errors": [str(e)]}

        # 4. Persist new tweets (ON CONFLICT DO NOTHING)
        new_count = 0
        for tweet_data in raw_tweets:
            author_handle = tweet_data.get("author_handle", "").lower()
            account = handle_to_account.get(author_handle)
            if not account:
                continue

            stmt = pg_insert(Tweet).values(
                twitter_account_id=account.id,
                tweet_id=tweet_data["tweet_id"],
                text=tweet_data["text"],
                created_at=tweet_data["created_at"],
                metrics=tweet_data.get("metrics", {}),
            ).on_conflict_do_nothing(index_elements=["tweet_id"])

            result = await self.session.execute(stmt)
            if result.rowcount and result.rowcount > 0:
                new_count += 1

        await self.session.commit()

        # 5. Broadcast via SSE
        if new_count > 0:
            # Fetch the newly inserted tweets for broadcast
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
            recent = await self.session.execute(
                select(Tweet, TwitterAccount)
                .join(TwitterAccount, TwitterAccount.id == Tweet.twitter_account_id)
                .where(Tweet.ingested_at >= cutoff)
                .order_by(Tweet.created_at.desc())
                .limit(new_count)
            )
            broadcast_tweets = []
            for tweet, account in recent.all():
                broadcast_tweets.append({
                    "id": tweet.id,
                    "tweetId": tweet.tweet_id,
                    "accountHandle": account.handle,
                    "accountDisplayName": account.display_name,
                    "accountCategory": account.category,
                    "text": tweet.text,
                    "createdAt": tweet.created_at.isoformat(),
                    "metrics": tweet.metrics,
                })

            await event_bus.publish("tweets", {
                "type": "tweet_update",
                "tweets": broadcast_tweets,
            })

        summary = {
            "new_tweets": new_count,
            "accounts_polled": len(accounts),
            "errors": errors,
        }
        logger.info(
            f"Twitter poll: {new_count} new tweets from {len(accounts)} accounts"
        )
        return summary
