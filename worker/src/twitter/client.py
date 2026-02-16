"""X/Twitter API v2 client with rate limiting and retry logic.

Follows the BinanceClient pattern: httpx async, semaphore concurrency,
exponential backoff, fail-open Redis caching.
"""

import asyncio
import json
import logging
from typing import Any

import httpx

from src.cache import cache_get, cache_set
from src.config import settings

logger = logging.getLogger(__name__)

SEARCH_RECENT_ENDPOINT = "https://api.x.com/2/tweets/search/recent"
MAX_QUERY_LENGTH = 512
HANDLES_PER_BATCH = 20
CACHE_TTL_SECONDS = 300  # 5 minutes


class TwitterAPIError(Exception):
    """Raised when the X API returns an error."""

    def __init__(self, status_code: int, message: str, retry_after: int | None = None):
        self.status_code = status_code
        self.message = message
        self.retry_after = retry_after
        super().__init__(f"Twitter API error {status_code}: {message}")


class TwitterClient:
    """HTTP client for X API v2 with rate limiting.

    Rate limits:
    - App-level: 450 requests per 15 min for search/recent (Basic tier)
    - Semaphore limits concurrent requests
    - Exponential backoff on 429/5xx

    Caching:
    - Fail-open Redis caching (5-min TTL) on search results
    """

    MAX_CONCURRENT_REQUESTS = 5
    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 1.0

    def __init__(self, bearer_token: str | None = None, timeout: float = 30.0):
        self.bearer_token = bearer_token or settings.twitter_bearer_token
        self.timeout = timeout
        self._semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_REQUESTS)

    async def _request(
        self,
        url: str,
        params: dict[str, Any] | None = None,
    ) -> dict:
        """Make an authenticated request to X API with retry logic."""
        headers = {
            "Authorization": f"Bearer {self.bearer_token}",
            "User-Agent": "AlphaBoard/1.0",
        }

        for attempt in range(self.MAX_RETRIES + 1):
            async with self._semaphore:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.get(url, params=params, headers=headers)

                        if response.status_code == 200:
                            return response.json()

                        if response.status_code == 429:
                            retry_after = int(response.headers.get("Retry-After", 60))
                            if attempt < self.MAX_RETRIES:
                                logger.warning(
                                    f"Twitter rate limited, waiting {retry_after}s"
                                )
                                await asyncio.sleep(retry_after)
                                continue
                            raise TwitterAPIError(429, "Rate limit exceeded", retry_after)

                        if response.status_code >= 500:
                            if attempt < self.MAX_RETRIES:
                                delay = self.BASE_RETRY_DELAY * (2 ** attempt)
                                logger.warning(
                                    f"Twitter server error {response.status_code}, "
                                    f"retrying in {delay}s (attempt {attempt + 1})"
                                )
                                await asyncio.sleep(delay)
                                continue

                        try:
                            error_data = response.json()
                            message = error_data.get("detail", response.text)
                        except Exception:
                            message = response.text

                        raise TwitterAPIError(response.status_code, message)

                except httpx.TimeoutException:
                    if attempt < self.MAX_RETRIES:
                        delay = self.BASE_RETRY_DELAY * (2 ** attempt)
                        logger.warning(
                            f"Twitter request timeout, retrying in {delay}s "
                            f"(attempt {attempt + 1})"
                        )
                        await asyncio.sleep(delay)
                        continue
                    raise TwitterAPIError(0, "Request timeout after all retries")

                except httpx.RequestError as e:
                    if attempt < self.MAX_RETRIES:
                        delay = self.BASE_RETRY_DELAY * (2 ** attempt)
                        logger.warning(
                            f"Twitter request error: {e}, retrying in {delay}s "
                            f"(attempt {attempt + 1})"
                        )
                        await asyncio.sleep(delay)
                        continue
                    raise TwitterAPIError(0, f"Request failed: {e}")

        raise TwitterAPIError(0, "Max retries exceeded")

    @staticmethod
    def _build_queries(handles: list[str]) -> list[str]:
        """Build search queries from handles, batching to stay under 512 char limit.

        Each query: (from:h1 OR from:h2 OR ...) -is:retweet -is:reply
        """
        queries: list[str] = []
        batch: list[str] = []

        for handle in handles:
            test_batch = batch + [handle]
            query = "(" + " OR ".join(f"from:{h}" for h in test_batch) + ") -is:retweet -is:reply"
            if len(query) > MAX_QUERY_LENGTH and batch:
                # Flush current batch
                queries.append(
                    "(" + " OR ".join(f"from:{h}" for h in batch) + ") -is:retweet -is:reply"
                )
                batch = [handle]
            else:
                batch = test_batch

            if len(batch) >= HANDLES_PER_BATCH:
                queries.append(
                    "(" + " OR ".join(f"from:{h}" for h in batch) + ") -is:retweet -is:reply"
                )
                batch = []

        if batch:
            queries.append(
                "(" + " OR ".join(f"from:{h}" for h in batch) + ") -is:retweet -is:reply"
            )

        return queries

    async def search_recent(
        self,
        handles: list[str],
        since_id: str | None = None,
    ) -> list[dict]:
        """Search recent tweets from given handles.

        Args:
            handles: List of Twitter handles (without @).
            since_id: Only return tweets newer than this tweet ID.

        Returns:
            List of tweet dicts with author info and metrics.
        """
        if not handles:
            return []

        # Check cache
        cache_key = f"twitter:search:{','.join(sorted(handles))}:{since_id or 'all'}"
        cached = await cache_get(cache_key)
        if cached:
            logger.debug(f"Cache HIT: twitter search ({len(handles)} handles)")
            return json.loads(cached)

        queries = self._build_queries(handles)
        all_tweets: list[dict] = []

        for query in queries:
            params: dict[str, Any] = {
                "query": query,
                "max_results": 100,
                "tweet.fields": "created_at,public_metrics,entities,attachments",
                "expansions": "author_id,attachments.media_keys",
                "user.fields": "username,name",
                "media.fields": "url,preview_image_url,type",
            }
            if since_id:
                params["since_id"] = since_id

            try:
                data = await self._request(SEARCH_RECENT_ENDPOINT, params)

                includes = data.get("includes", {})

                # Build author lookup
                authors: dict[str, dict] = {}
                for user in includes.get("users", []):
                    authors[user["id"]] = {
                        "username": user["username"],
                        "name": user.get("name", user["username"]),
                    }

                # Build media lookup
                media_map: dict[str, dict] = {}
                for media in includes.get("media", []):
                    media_map[media["media_key"]] = {
                        "type": media.get("type"),
                        "url": media.get("url") or media.get("preview_image_url"),
                    }

                # Process tweets
                for tweet in data.get("data", []):
                    author = authors.get(tweet.get("author_id", ""), {})

                    # Resolve media URLs from attachments
                    media_urls: list[str] = []
                    media_keys = (
                        tweet.get("attachments", {}).get("media_keys", [])
                    )
                    for key in media_keys:
                        m = media_map.get(key)
                        if m and m.get("url"):
                            media_urls.append(m["url"])

                    all_tweets.append({
                        "tweet_id": tweet["id"],
                        "text": tweet["text"],
                        "created_at": tweet["created_at"],
                        "author_handle": author.get("username", ""),
                        "author_name": author.get("name", ""),
                        "metrics": tweet.get("public_metrics", {}),
                        "media_urls": media_urls,
                    })

            except TwitterAPIError as e:
                logger.error(f"Twitter search failed for query batch: {e}")

        # Cache results (fail-open)
        try:
            await cache_set(cache_key, json.dumps(all_tweets), CACHE_TTL_SECONDS)
        except Exception:
            pass

        return all_tweets
