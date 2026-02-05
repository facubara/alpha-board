"""Pydantic models and type definitions for Binance exchange data."""

from datetime import datetime
from decimal import Decimal
from typing import TypedDict

import pandas as pd
from pydantic import BaseModel, Field


class Symbol(BaseModel):
    """Trading pair metadata from Binance."""

    symbol: str = Field(..., description="Trading pair symbol, e.g., BTCUSDT")
    base_asset: str = Field(..., description="Base asset, e.g., BTC")
    quote_asset: str = Field(..., description="Quote asset, e.g., USDT")
    status: str = Field(..., description="Trading status: TRADING, HALT, BREAK")
    is_spot_trading_allowed: bool = Field(default=True)
    quote_volume_24h: Decimal | None = Field(
        default=None, description="24h quote volume in USDT"
    )

    @property
    def is_active(self) -> bool:
        """Check if the symbol is actively trading."""
        return self.status == "TRADING" and self.is_spot_trading_allowed


class Candle(BaseModel):
    """Single OHLCV candle from Binance klines endpoint."""

    open_time: datetime = Field(..., description="Candle open time (UTC)")
    open: Decimal = Field(..., description="Open price")
    high: Decimal = Field(..., description="High price")
    low: Decimal = Field(..., description="Low price")
    close: Decimal = Field(..., description="Close price")
    volume: Decimal = Field(..., description="Base asset volume")
    close_time: datetime = Field(..., description="Candle close time (UTC)")
    quote_volume: Decimal = Field(..., description="Quote asset volume")
    trades: int = Field(..., description="Number of trades")

    model_config = {"frozen": True}


class OHLCVRow(TypedDict):
    """Type definition for a single row in an OHLCV DataFrame."""

    open_time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    close_time: datetime
    quote_volume: float
    trades: int


# Type alias for OHLCV DataFrame
OHLCVDataFrame = pd.DataFrame
"""DataFrame with columns: open_time, open, high, low, close, volume, close_time, quote_volume, trades.

All price/volume columns are float64 for compatibility with pandas-ta.
Index is the default integer index (not datetime).
"""


def candles_to_dataframe(candles: list[Candle]) -> OHLCVDataFrame:
    """Convert a list of Candle objects to an OHLCV DataFrame.

    Args:
        candles: List of Candle objects, ordered by open_time ascending.

    Returns:
        DataFrame with float64 columns for OHLCV data, suitable for pandas-ta.
    """
    if not candles:
        return pd.DataFrame(
            columns=[
                "open_time",
                "open",
                "high",
                "low",
                "close",
                "volume",
                "close_time",
                "quote_volume",
                "trades",
            ]
        )

    data = [
        {
            "open_time": c.open_time,
            "open": float(c.open),
            "high": float(c.high),
            "low": float(c.low),
            "close": float(c.close),
            "volume": float(c.volume),
            "close_time": c.close_time,
            "quote_volume": float(c.quote_volume),
            "trades": c.trades,
        }
        for c in candles
    ]
    return pd.DataFrame(data)


# Binance interval constants
INTERVALS = {
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
    "1w": "1w",
}

# Minimum candles needed for longest indicator (200-period EMA)
MIN_CANDLES_REQUIRED = 200
