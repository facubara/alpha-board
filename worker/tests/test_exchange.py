"""Unit tests for Binance exchange client."""

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from src.exchange import BinanceClient, BinanceAPIError, Symbol, Candle, candles_to_dataframe


# Sample exchange info response
MOCK_EXCHANGE_INFO = {
    "symbols": [
        {
            "symbol": "BTCUSDT",
            "baseAsset": "BTC",
            "quoteAsset": "USDT",
            "status": "TRADING",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "ETHUSDT",
            "baseAsset": "ETH",
            "quoteAsset": "USDT",
            "status": "TRADING",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "BTCEUR",  # Not USDT pair, should be filtered
            "baseAsset": "BTC",
            "quoteAsset": "EUR",
            "status": "TRADING",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "LOWVOLUSD",  # Low volume, should be filtered
            "baseAsset": "LOWVOL",
            "quoteAsset": "USDT",
            "status": "TRADING",
            "isSpotTradingAllowed": True,
        },
    ]
}

# Sample 24h ticker response
MOCK_TICKERS = [
    {"symbol": "BTCUSDT", "quoteVolume": "5000000000"},  # $5B
    {"symbol": "ETHUSDT", "quoteVolume": "2000000000"},  # $2B
    {"symbol": "BTCEUR", "quoteVolume": "100000000"},
    {"symbol": "LOWVOLUSD", "quoteVolume": "500000"},  # $500K - below threshold
]

# Sample klines response (Binance format)
MOCK_KLINES = [
    [
        1704067200000,  # open_time (ms)
        "42000.00",  # open
        "42500.00",  # high
        "41800.00",  # low
        "42300.00",  # close
        "1000.5",  # volume
        1704070799999,  # close_time (ms)
        "42150000.00",  # quote_volume
        50000,  # trades
        "500.25",  # taker_buy_base
        "21075000.00",  # taker_buy_quote
        "0",  # ignore
    ],
    [
        1704070800000,
        "42300.00",
        "42800.00",
        "42200.00",
        "42600.00",
        "1200.75",
        1704074399999,
        "51030000.00",
        55000,
        "600.40",
        "25575000.00",
        "0",
    ],
]


class TestSymbol:
    """Tests for Symbol Pydantic model."""

    def test_symbol_creation(self):
        """Test creating a Symbol from dict."""
        sym = Symbol(
            symbol="BTCUSDT",
            base_asset="BTC",
            quote_asset="USDT",
            status="TRADING",
            is_spot_trading_allowed=True,
            quote_volume_24h=Decimal("5000000000"),
        )
        assert sym.symbol == "BTCUSDT"
        assert sym.base_asset == "BTC"
        assert sym.is_active is True

    def test_symbol_inactive_when_not_trading(self):
        """Test that non-trading symbols are marked inactive."""
        sym = Symbol(
            symbol="BTCUSDT",
            base_asset="BTC",
            quote_asset="USDT",
            status="HALT",
            is_spot_trading_allowed=True,
        )
        assert sym.is_active is False


class TestCandle:
    """Tests for Candle Pydantic model."""

    def test_candle_from_binance_data(self):
        """Test creating a Candle from Binance klines format."""
        row = MOCK_KLINES[0]
        candle = Candle(
            open_time=datetime.fromtimestamp(row[0] / 1000, tz=timezone.utc),
            open=Decimal(row[1]),
            high=Decimal(row[2]),
            low=Decimal(row[3]),
            close=Decimal(row[4]),
            volume=Decimal(row[5]),
            close_time=datetime.fromtimestamp(row[6] / 1000, tz=timezone.utc),
            quote_volume=Decimal(row[7]),
            trades=int(row[8]),
        )
        assert candle.open == Decimal("42000.00")
        assert candle.close == Decimal("42300.00")
        assert candle.trades == 50000


class TestCandlesToDataframe:
    """Tests for candles_to_dataframe conversion."""

    def test_empty_list_returns_empty_dataframe(self):
        """Test that empty candle list returns DataFrame with correct columns."""
        df = candles_to_dataframe([])
        assert len(df) == 0
        assert "open" in df.columns
        assert "close" in df.columns
        assert "volume" in df.columns

    def test_converts_candles_to_float(self):
        """Test that Decimal values are converted to float64."""
        candles = [
            Candle(
                open_time=datetime.now(timezone.utc),
                open=Decimal("42000.00"),
                high=Decimal("42500.00"),
                low=Decimal("41800.00"),
                close=Decimal("42300.00"),
                volume=Decimal("1000.5"),
                close_time=datetime.now(timezone.utc),
                quote_volume=Decimal("42150000.00"),
                trades=50000,
            )
        ]
        df = candles_to_dataframe(candles)
        assert len(df) == 1
        assert df["open"].iloc[0] == 42000.0
        assert isinstance(df["open"].iloc[0], float)


class TestBinanceClient:
    """Tests for BinanceClient with mocked HTTP responses."""

    @pytest.fixture
    def client(self):
        """Create a BinanceClient instance."""
        return BinanceClient(base_url="https://api.binance.com")

    @pytest.mark.asyncio
    async def test_get_active_symbols(self, client):
        """Test fetching active symbols with volume filtering."""
        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = [MOCK_EXCHANGE_INFO, MOCK_TICKERS]

            symbols = await client.get_active_symbols(min_volume_usd=1_000_000)

            # Should only return BTCUSDT and ETHUSDT (USDT pairs above volume)
            assert len(symbols) == 2
            assert symbols[0].symbol == "BTCUSDT"  # Highest volume first
            assert symbols[1].symbol == "ETHUSDT"

    @pytest.mark.asyncio
    async def test_get_klines(self, client):
        """Test fetching klines for a single symbol."""
        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = MOCK_KLINES

            candles = await client.get_klines("BTCUSDT", "1h", limit=2)

            assert len(candles) == 2
            assert candles[0].open == Decimal("42000.00")
            assert candles[1].close == Decimal("42600.00")

            mock_request.assert_called_once_with(
                "GET",
                "/api/v3/klines",
                {"symbol": "BTCUSDT", "interval": "1h", "limit": 2},
            )

    @pytest.mark.asyncio
    async def test_get_klines_batch(self, client):
        """Test batch fetching klines for multiple symbols."""
        with patch.object(client, "get_klines", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = [
                Candle(
                    open_time=datetime.now(timezone.utc),
                    open=Decimal("100"),
                    high=Decimal("110"),
                    low=Decimal("90"),
                    close=Decimal("105"),
                    volume=Decimal("1000"),
                    close_time=datetime.now(timezone.utc),
                    quote_volume=Decimal("100000"),
                    trades=500,
                )
            ]

            results = await client.get_klines_batch(
                ["BTCUSDT", "ETHUSDT"], "1h", limit=50
            )

            assert len(results) == 2
            assert "BTCUSDT" in results
            assert "ETHUSDT" in results
            assert len(results["BTCUSDT"]) == 1

    @pytest.mark.asyncio
    async def test_get_klines_batch_handles_errors(self, client):
        """Test that batch fetch continues when some symbols fail."""
        with patch.object(client, "get_klines", new_callable=AsyncMock) as mock_get:

            async def side_effect(symbol, interval, limit):
                if symbol == "FAILUSDT":
                    raise BinanceAPIError(400, "Invalid symbol")
                return [
                    Candle(
                        open_time=datetime.now(timezone.utc),
                        open=Decimal("100"),
                        high=Decimal("110"),
                        low=Decimal("90"),
                        close=Decimal("105"),
                        volume=Decimal("1000"),
                        close_time=datetime.now(timezone.utc),
                        quote_volume=Decimal("100000"),
                        trades=500,
                    )
                ]

            mock_get.side_effect = side_effect

            results = await client.get_klines_batch(
                ["BTCUSDT", "FAILUSDT", "ETHUSDT"], "1h", limit=50
            )

            # Should have 2 results (FAILUSDT failed)
            assert len(results) == 2
            assert "BTCUSDT" in results
            assert "ETHUSDT" in results
            assert "FAILUSDT" not in results


class TestRetryLogic:
    """Tests for retry and rate limiting logic."""

    @pytest.fixture
    def client(self):
        """Create a BinanceClient with short retry delays for testing."""
        client = BinanceClient(base_url="https://api.binance.com")
        client.BASE_RETRY_DELAY = 0.01  # Speed up tests
        return client

    @pytest.mark.asyncio
    async def test_retries_on_server_error(self, client):
        """Test that 5xx errors trigger retries."""
        call_count = 0

        async def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            class MockResponse:
                def __init__(self, status, data):
                    self.status_code = status
                    self._data = data
                    self.text = str(data)
                    self.headers = {}

                def json(self):
                    return self._data

            if call_count < 3:
                return MockResponse(500, {"msg": "Server error"})
            return MockResponse(200, {"symbols": []})

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request = mock_request
            mock_client_class.return_value = mock_client

            result = await client._request("GET", "/test")

            assert call_count == 3  # 2 failures + 1 success
            assert result == {"symbols": []}
