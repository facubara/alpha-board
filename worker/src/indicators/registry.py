"""Indicator registry for centralized indicator management.

The registry holds all indicator definitions and provides methods to compute
all indicators for a given OHLCV DataFrame.
"""

from dataclasses import dataclass
from typing import Any, Callable, TypedDict

import pandas as pd

from src.indicators.compute import (
    compute_adx,
    compute_bollinger,
    compute_ema,
    compute_macd,
    compute_obv,
    compute_rsi,
    compute_stochastic,
)
from src.indicators.signals import (
    SignalResult,
    normalize_adx,
    normalize_bollinger,
    normalize_ema,
    normalize_macd,
    normalize_obv,
    normalize_rsi,
    normalize_stochastic,
)


class IndicatorOutput(TypedDict):
    """Output for a single indicator computation."""

    name: str
    display_name: str
    category: str
    weight: float
    raw: dict[str, Any]  # Raw indicator values
    signal: SignalResult  # Normalized signal


@dataclass
class IndicatorDefinition:
    """Definition of an indicator with its compute and normalize functions."""

    name: str
    display_name: str
    category: str
    weight: float
    config: dict[str, Any]
    compute_fn: Callable[[pd.DataFrame], dict[str, Any]]
    normalize_fn: Callable[[dict[str, Any], dict[str, Any]], SignalResult]


class IndicatorRegistry:
    """Registry for technical indicators.

    Manages indicator definitions and provides methods to compute all
    indicators for a given OHLCV DataFrame.
    """

    def __init__(self) -> None:
        """Initialize an empty registry."""
        self._indicators: dict[str, IndicatorDefinition] = {}

    def register(
        self,
        name: str,
        display_name: str,
        category: str,
        weight: float,
        config: dict[str, Any],
        compute_fn: Callable[[pd.DataFrame], dict[str, Any]],
        normalize_fn: Callable[[dict[str, Any], dict[str, Any]], SignalResult],
    ) -> None:
        """Register an indicator.

        Args:
            name: Unique indicator name (e.g., 'rsi_14').
            display_name: Human-readable name (e.g., 'RSI (14)').
            category: Category (momentum, trend, volume, volatility).
            weight: Weight for composite scoring (0-1).
            config: Indicator-specific configuration.
            compute_fn: Function to compute raw values from DataFrame.
            normalize_fn: Function to normalize raw values to signal.
        """
        self._indicators[name] = IndicatorDefinition(
            name=name,
            display_name=display_name,
            category=category,
            weight=weight,
            config=config,
            compute_fn=compute_fn,
            normalize_fn=normalize_fn,
        )

    def get(self, name: str) -> IndicatorDefinition | None:
        """Get an indicator definition by name."""
        return self._indicators.get(name)

    def list_names(self) -> list[str]:
        """List all registered indicator names."""
        return list(self._indicators.keys())

    def compute_one(self, name: str, df: pd.DataFrame) -> IndicatorOutput | None:
        """Compute a single indicator.

        Args:
            name: Indicator name.
            df: OHLCV DataFrame.

        Returns:
            IndicatorOutput or None if indicator not found.
        """
        ind = self._indicators.get(name)
        if ind is None:
            return None

        raw = ind.compute_fn(df)
        signal = ind.normalize_fn(raw, ind.config)

        return {
            "name": ind.name,
            "display_name": ind.display_name,
            "category": ind.category,
            "weight": ind.weight,
            "raw": raw,
            "signal": signal,
        }

    def compute_all(self, df: pd.DataFrame) -> dict[str, IndicatorOutput]:
        """Compute all registered indicators.

        Args:
            df: OHLCV DataFrame with columns: open, high, low, close, volume.

        Returns:
            Dict mapping indicator name to IndicatorOutput.
        """
        results: dict[str, IndicatorOutput] = {}

        for name, ind in self._indicators.items():
            raw = ind.compute_fn(df)
            signal = ind.normalize_fn(raw, ind.config)

            results[name] = {
                "name": ind.name,
                "display_name": ind.display_name,
                "category": ind.category,
                "weight": ind.weight,
                "raw": raw,
                "signal": signal,
            }

        return results

    def total_weight(self) -> float:
        """Get the sum of all indicator weights."""
        return sum(ind.weight for ind in self._indicators.values())


def create_default_registry() -> IndicatorRegistry:
    """Create a registry with all default indicators.

    Uses the standard 9 indicators with default configurations.
    In production, configs would be loaded from the database.

    Returns:
        IndicatorRegistry with all indicators registered.
    """
    registry = IndicatorRegistry()

    # RSI (14)
    registry.register(
        name="rsi_14",
        display_name="RSI (14)",
        category="momentum",
        weight=0.12,
        config={"period": 14, "oversold": 30, "overbought": 70},
        compute_fn=lambda df: compute_rsi(df, period=14),
        normalize_fn=normalize_rsi,
    )

    # MACD (12, 26, 9)
    registry.register(
        name="macd_12_26_9",
        display_name="MACD (12,26,9)",
        category="momentum",
        weight=0.15,
        config={"fast": 12, "slow": 26, "signal": 9},
        compute_fn=lambda df: compute_macd(df, fast=12, slow=26, signal=9),
        normalize_fn=normalize_macd,
    )

    # Stochastic (14, 3, 3)
    registry.register(
        name="stoch_14_3_3",
        display_name="Stochastic (14,3,3)",
        category="momentum",
        weight=0.10,
        config={"k": 14, "d": 3, "smooth": 3},
        compute_fn=lambda df: compute_stochastic(df, k=14, d=3, smooth=3),
        normalize_fn=normalize_stochastic,
    )

    # ADX (14)
    registry.register(
        name="adx_14",
        display_name="ADX (14)",
        category="trend",
        weight=0.13,
        config={"period": 14, "trend_threshold": 25},
        compute_fn=lambda df: compute_adx(df, period=14),
        normalize_fn=normalize_adx,
    )

    # OBV
    registry.register(
        name="obv",
        display_name="OBV",
        category="volume",
        weight=0.12,
        config={"slope_period": 10},
        compute_fn=lambda df: compute_obv(df, slope_period=10),
        normalize_fn=normalize_obv,
    )

    # Bollinger Bands (20, 2)
    registry.register(
        name="bbands_20_2",
        display_name="Bollinger Bands (20,2)",
        category="volatility",
        weight=0.10,
        config={"period": 20, "std": 2},
        compute_fn=lambda df: compute_bollinger(df, period=20, std=2.0),
        normalize_fn=normalize_bollinger,
    )

    # EMA (20)
    registry.register(
        name="ema_20",
        display_name="EMA (20)",
        category="trend",
        weight=0.08,
        config={"period": 20, "neutral_pct": 0.5},
        compute_fn=lambda df: compute_ema(df, period=20),
        normalize_fn=normalize_ema,
    )

    # EMA (50)
    registry.register(
        name="ema_50",
        display_name="EMA (50)",
        category="trend",
        weight=0.10,
        config={"period": 50, "neutral_pct": 1.0},
        compute_fn=lambda df: compute_ema(df, period=50),
        normalize_fn=normalize_ema,
    )

    # EMA (200)
    registry.register(
        name="ema_200",
        display_name="EMA (200)",
        category="trend",
        weight=0.10,
        config={"period": 200, "neutral_pct": 1.5},
        compute_fn=lambda df: compute_ema(df, period=200),
        normalize_fn=normalize_ema,
    )

    return registry


# Default global registry instance
default_registry = create_default_registry()
