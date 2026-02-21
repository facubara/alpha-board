"""DexScreener API client (free, no auth).

Rate limit: 60 req/min. Uses httpx + semaphore + caching.
"""

import asyncio
import json
import logging
from typing import Any

import httpx

from src.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

BASE_URL = "https://api.dexscreener.com"
CACHE_TTL_SECONDS = 60


class DexScreenerAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"DexScreener API error {status_code}: {message}")


class DexScreenerClient:
    """HTTP client for DexScreener free API."""

    MAX_CONCURRENT_REQUESTS = 5
    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 1.0

    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout
        self._semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_REQUESTS)

    async def _request(self, url: str, params: dict[str, Any] | None = None) -> Any:
        """Make a GET request with retry logic."""
        for attempt in range(self.MAX_RETRIES + 1):
            async with self._semaphore:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.get(url, params=params)

                        if response.status_code == 200:
                            return response.json()

                        if response.status_code == 429:
                            if attempt < self.MAX_RETRIES:
                                delay = self.BASE_RETRY_DELAY * (2 ** attempt)
                                logger.warning(f"DexScreener rate limited, waiting {delay}s")
                                await asyncio.sleep(delay)
                                continue
                            raise DexScreenerAPIError(429, "Rate limit exceeded")

                        if response.status_code >= 500:
                            if attempt < self.MAX_RETRIES:
                                delay = self.BASE_RETRY_DELAY * (2 ** attempt)
                                await asyncio.sleep(delay)
                                continue

                        raise DexScreenerAPIError(response.status_code, response.text[:200])

                except httpx.TimeoutException:
                    if attempt < self.MAX_RETRIES:
                        await asyncio.sleep(self.BASE_RETRY_DELAY * (2 ** attempt))
                        continue
                    raise DexScreenerAPIError(0, "Request timeout after all retries")

                except httpx.RequestError as e:
                    if attempt < self.MAX_RETRIES:
                        await asyncio.sleep(self.BASE_RETRY_DELAY * (2 ** attempt))
                        continue
                    raise DexScreenerAPIError(0, f"Request failed: {e}")

        raise DexScreenerAPIError(0, "Max retries exceeded")

    async def search_tokens(self, query: str) -> list[dict]:
        """Search for tokens by name/symbol. Returns pairs."""
        cache_key = f"dex:search:{query.lower()}"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)

        url = f"{BASE_URL}/latest/dex/search"
        data = await self._request(url, params={"q": query})
        pairs = data.get("pairs", []) if isinstance(data, dict) else []

        try:
            await cache_set(cache_key, json.dumps(pairs), CACHE_TTL_SECONDS)
        except Exception:
            pass

        return pairs

    async def get_token_pairs(self, mint: str) -> list[dict]:
        """Get trading pairs for a specific token mint address."""
        cache_key = f"dex:pairs:{mint}"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)

        url = f"{BASE_URL}/latest/dex/tokens/{mint}"
        data = await self._request(url)
        pairs = data.get("pairs", []) if isinstance(data, dict) else []

        try:
            await cache_set(cache_key, json.dumps(pairs), CACHE_TTL_SECONDS)
        except Exception:
            pass

        return pairs

    async def get_top_boosts(self) -> list[dict]:
        """Get top boosted tokens (trending)."""
        cache_key = "dex:top_boosts"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)

        url = f"{BASE_URL}/token-boosts/top/v1"
        data = await self._request(url)
        tokens = data if isinstance(data, list) else []

        try:
            await cache_set(cache_key, json.dumps(tokens), CACHE_TTL_SECONDS)
        except Exception:
            pass

        return tokens
