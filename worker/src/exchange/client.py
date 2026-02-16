"""Binance REST API client with rate limiting and retry logic."""

import asyncio
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import httpx

from src.cache import cache_get, cache_set
from src.config import settings
from src.exchange.types import (
    Candle,
    OHLCVDataFrame,
    Symbol,
    candles_to_dataframe,
)

logger = logging.getLogger(__name__)

# TTL for klines cache by interval
KLINES_TTL: dict[str, int] = {
    "15m": 120,
    "30m": 300,
    "1h": 600,
    "4h": 1800,
    "1d": 7200,
    "1w": 14400,
}


class BinanceAPIError(Exception):
    """Raised when Binance API returns an error."""

    def __init__(self, status_code: int, message: str, retry_after: int | None = None):
        self.status_code = status_code
        self.message = message
        self.retry_after = retry_after
        super().__init__(f"Binance API error {status_code}: {message}")


class BinanceClient:
    """HTTP client for Binance REST API with rate limiting.

    Rate limits:
    - 1200 requests per minute (weight-based, most endpoints weight=1)
    - We use a semaphore to limit concurrent requests
    - We add a small delay between requests to stay well under the limit

    Retry logic:
    - 3 retries with exponential backoff for timeouts and 5xx errors
    - Respect Retry-After header for 429 (rate limit) responses
    """

    # Rate limiting configuration
    MAX_CONCURRENT_REQUESTS = 10
    REQUEST_DELAY_SECONDS = 0.05  # 50ms between requests = max 1200/min
    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 1.0  # Base delay in seconds for exponential backoff

    # API endpoints
    EXCHANGE_INFO_ENDPOINT = "/api/v3/exchangeInfo"
    TICKER_24H_ENDPOINT = "/api/v3/ticker/24hr"
    TICKER_PRICE_ENDPOINT = "/api/v3/ticker/price"
    KLINES_ENDPOINT = "/api/v3/klines"

    def __init__(self, base_url: str | None = None, timeout: float = 30.0):
        """Initialize the Binance client.

        Args:
            base_url: Binance API base URL. Defaults to settings.binance_base_url.
            timeout: Request timeout in seconds.
        """
        self.base_url = base_url or settings.binance_base_url
        self.timeout = timeout
        self._semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_REQUESTS)
        self._last_request_time: float = 0

    async def _request(
        self, method: str, endpoint: str, params: dict[str, Any] | None = None
    ) -> Any:
        """Make a rate-limited request to Binance API with retry logic.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            params: Query parameters

        Returns:
            Parsed JSON response

        Raises:
            BinanceAPIError: If the API returns an error after all retries
        """
        url = f"{self.base_url}{endpoint}"

        for attempt in range(self.MAX_RETRIES + 1):
            async with self._semaphore:
                # Rate limiting: ensure minimum delay between requests
                now = asyncio.get_event_loop().time()
                elapsed = now - self._last_request_time
                if elapsed < self.REQUEST_DELAY_SECONDS:
                    await asyncio.sleep(self.REQUEST_DELAY_SECONDS - elapsed)
                self._last_request_time = asyncio.get_event_loop().time()

                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.request(method, url, params=params)

                        if response.status_code == 200:
                            return response.json()

                        # Handle rate limiting
                        if response.status_code == 429:
                            retry_after = int(
                                response.headers.get("Retry-After", 60)
                            )
                            if attempt < self.MAX_RETRIES:
                                logger.warning(
                                    f"Rate limited, waiting {retry_after}s before retry"
                                )
                                await asyncio.sleep(retry_after)
                                continue
                            raise BinanceAPIError(
                                429, "Rate limit exceeded", retry_after
                            )

                        # Handle server errors with retry
                        if response.status_code >= 500:
                            if attempt < self.MAX_RETRIES:
                                delay = self.BASE_RETRY_DELAY * (2**attempt)
                                logger.warning(
                                    f"Server error {response.status_code}, "
                                    f"retrying in {delay}s (attempt {attempt + 1})"
                                )
                                await asyncio.sleep(delay)
                                continue

                        # Parse error response
                        try:
                            error_data = response.json()
                            message = error_data.get("msg", response.text)
                        except Exception:
                            message = response.text

                        raise BinanceAPIError(response.status_code, message)

                except httpx.TimeoutException:
                    if attempt < self.MAX_RETRIES:
                        delay = self.BASE_RETRY_DELAY * (2**attempt)
                        logger.warning(
                            f"Request timeout, retrying in {delay}s "
                            f"(attempt {attempt + 1})"
                        )
                        await asyncio.sleep(delay)
                        continue
                    raise BinanceAPIError(0, "Request timeout after all retries")

                except httpx.RequestError as e:
                    if attempt < self.MAX_RETRIES:
                        delay = self.BASE_RETRY_DELAY * (2**attempt)
                        logger.warning(
                            f"Request error: {e}, retrying in {delay}s "
                            f"(attempt {attempt + 1})"
                        )
                        await asyncio.sleep(delay)
                        continue
                    raise BinanceAPIError(0, f"Request failed: {e}")

        # Should not reach here, but just in case
        raise BinanceAPIError(0, "Max retries exceeded")

    async def get_active_symbols(
        self, min_volume_usd: float = 1_000_000
    ) -> list[Symbol]:
        """Fetch all active USDT spot trading pairs above volume threshold.

        Args:
            min_volume_usd: Minimum 24h quote volume in USD to include.

        Returns:
            List of Symbol objects for active trading pairs.
        """
        # Check cache first (5 min TTL)
        cached = await cache_get("active_symbols")
        if cached:
            data = json.loads(cached)
            logger.debug(f"Cache HIT: active_symbols ({len(data)} symbols)")
            return [Symbol(**s) for s in data]

        # Get exchange info for symbol metadata
        exchange_info = await self._request("GET", self.EXCHANGE_INFO_ENDPOINT)

        # Filter for USDT spot pairs
        usdt_symbols: dict[str, dict] = {}
        for sym in exchange_info.get("symbols", []):
            if (
                sym.get("quoteAsset") == "USDT"
                and sym.get("status") == "TRADING"
                and sym.get("isSpotTradingAllowed", False)
            ):
                usdt_symbols[sym["symbol"]] = {
                    "symbol": sym["symbol"],
                    "base_asset": sym["baseAsset"],
                    "quote_asset": sym["quoteAsset"],
                    "status": sym["status"],
                    "is_spot_trading_allowed": sym.get("isSpotTradingAllowed", True),
                }

        if not usdt_symbols:
            return []

        # Get 24h volume data for all symbols
        tickers = await self._request("GET", self.TICKER_24H_ENDPOINT)

        # Merge volume data and filter by volume threshold
        symbols: list[Symbol] = []
        for ticker in tickers:
            symbol_name = ticker.get("symbol")
            if symbol_name not in usdt_symbols:
                continue

            quote_volume = Decimal(ticker.get("quoteVolume", "0"))
            if quote_volume >= min_volume_usd:
                sym_data = usdt_symbols[symbol_name]
                sym_data["quote_volume_24h"] = quote_volume
                symbols.append(Symbol(**sym_data))

        # Sort by volume descending
        symbols.sort(key=lambda s: s.quote_volume_24h or 0, reverse=True)

        logger.info(
            f"Found {len(symbols)} active USDT pairs with volume >= ${min_volume_usd:,.0f}"
        )

        # Store in cache
        serializable = [
            {
                "symbol": s.symbol,
                "base_asset": s.base_asset,
                "quote_asset": s.quote_asset,
                "status": s.status,
                "is_spot_trading_allowed": s.is_spot_trading_allowed,
                "quote_volume_24h": str(s.quote_volume_24h),
            }
            for s in symbols
        ]
        await cache_set("active_symbols", json.dumps(serializable), 300)

        return symbols

    async def get_ticker_prices(self) -> dict[str, Decimal]:
        """Fetch current prices for all symbols.

        Uses the lightweight /api/v3/ticker/price endpoint (weight=2).

        Returns:
            Dict mapping symbol name to current price.
        """
        # Check cache first (15s TTL)
        cached = await cache_get("live_prices")
        if cached:
            data = json.loads(cached)
            logger.debug("Cache HIT: live_prices")
            return {k: Decimal(v) for k, v in data.items()}

        data = await self._request("GET", self.TICKER_PRICE_ENDPOINT)
        result = {item["symbol"]: Decimal(item["price"]) for item in data}

        # Store in cache — serialize Decimals as strings
        await cache_set(
            "live_prices",
            json.dumps({k: str(v) for k, v in result.items()}),
            15,
        )
        return result

    @staticmethod
    def _parse_klines(data: list) -> list[Candle]:
        """Parse raw Binance klines response into Candle objects."""
        candles: list[Candle] = []
        for row in data:
            # Binance klines format:
            # [open_time, open, high, low, close, volume, close_time,
            #  quote_volume, trades, taker_buy_base, taker_buy_quote, ignore]
            candles.append(
                Candle(
                    open_time=datetime.fromtimestamp(row[0] / 1000, tz=timezone.utc),
                    open=Decimal(str(row[1])),
                    high=Decimal(str(row[2])),
                    low=Decimal(str(row[3])),
                    close=Decimal(str(row[4])),
                    volume=Decimal(str(row[5])),
                    close_time=datetime.fromtimestamp(row[6] / 1000, tz=timezone.utc),
                    quote_volume=Decimal(str(row[7])),
                    trades=int(row[8]),
                )
            )
        return candles

    async def get_klines(
        self, symbol: str, interval: str, limit: int = 200
    ) -> list[Candle]:
        """Fetch OHLCV candles for a single symbol.

        Args:
            symbol: Trading pair symbol, e.g., "BTCUSDT"
            interval: Candle interval: 15m, 30m, 1h, 4h, 1d, 1w
            limit: Number of candles to fetch (max 1000)

        Returns:
            List of Candle objects, ordered by open_time ascending.
        """
        # Check cache first (TTL varies by interval)
        cache_key = f"klines:{symbol}:{interval}"
        cached = await cache_get(cache_key)
        if cached:
            raw = json.loads(cached)
            logger.debug(f"Cache HIT: {cache_key}")
            return self._parse_klines(raw)

        params = {
            "symbol": symbol,
            "interval": interval,
            "limit": min(limit, 1000),
        }

        data = await self._request("GET", self.KLINES_ENDPOINT, params)

        # Cache the raw Binance response (before Decimal parsing)
        ttl = KLINES_TTL.get(interval, 300)
        await cache_set(cache_key, json.dumps(data), ttl)

        return self._parse_klines(data)

    async def get_klines_batch(
        self, symbols: list[str], interval: str, limit: int = 200
    ) -> dict[str, OHLCVDataFrame]:
        """Fetch OHLCV candles for multiple symbols with concurrency control.

        Args:
            symbols: List of trading pair symbols
            interval: Candle interval
            limit: Number of candles per symbol

        Returns:
            Dict mapping symbol to OHLCV DataFrame. Symbols that failed to fetch
            are omitted from the result.
        """
        results: dict[str, OHLCVDataFrame] = {}
        errors: list[tuple[str, str]] = []

        async def fetch_one(symbol: str) -> None:
            try:
                candles = await self.get_klines(symbol, interval, limit)
                results[symbol] = candles_to_dataframe(candles)
            except BinanceAPIError as e:
                errors.append((symbol, str(e)))
                logger.warning(f"Failed to fetch {symbol}: {e}")
            except Exception as e:
                errors.append((symbol, str(e)))
                logger.error(f"Unexpected error fetching {symbol}: {e}")

        # Fetch all symbols concurrently (rate limiting handled by _request)
        await asyncio.gather(*[fetch_one(s) for s in symbols])

        if errors:
            logger.warning(
                f"Failed to fetch {len(errors)}/{len(symbols)} symbols: "
                f"{[e[0] for e in errors[:5]]}{'...' if len(errors) > 5 else ''}"
            )

        logger.info(
            f"Successfully fetched {len(results)}/{len(symbols)} symbols "
            f"({interval}, {limit} candles each)"
        )
        return results
