"""Highlight chip generation for symbol rankings.

Generates up to 4 highlight chips per symbol based on the most significant
indicator signals. Chips provide quick visual summaries of key market conditions.
"""

from dataclasses import dataclass
from typing import Literal

from src.indicators.registry import IndicatorOutput


@dataclass
class HighlightChip:
    """A highlight chip for display in the rankings table."""

    text: str  # Short display text (e.g., "RSI Oversold")
    category: Literal["bullish", "bearish", "neutral", "info"]
    priority: int  # Higher = more important (used for sorting)
    indicator: str  # Source indicator name


# Highlight generation rules
# Each rule checks indicator output and returns a chip if conditions are met


def _check_rsi_extremes(output: IndicatorOutput) -> HighlightChip | None:
    """Check for RSI extreme conditions."""
    raw = output["raw"]
    value = raw.get("value")

    if value is None or value != value:  # NaN check
        return None

    if value <= 25:
        return HighlightChip(
            text="RSI Oversold",
            category="bullish",
            priority=90,
            indicator="rsi_14",
        )
    elif value >= 75:
        return HighlightChip(
            text="RSI Overbought",
            category="bearish",
            priority=90,
            indicator="rsi_14",
        )
    return None


def _check_macd_cross(output: IndicatorOutput) -> HighlightChip | None:
    """Check for MACD crossover signals."""
    raw = output["raw"]
    histogram = raw.get("histogram")
    macd = raw.get("macd")

    if histogram is None or macd is None:
        return None
    if histogram != histogram or macd != macd:  # NaN check
        return None

    # Strong histogram relative to MACD line indicates momentum
    if abs(macd) > 0:
        relative = histogram / abs(macd)
        if relative > 0.5:
            return HighlightChip(
                text="MACD Bullish",
                category="bullish",
                priority=85,
                indicator="macd_12_26_9",
            )
        elif relative < -0.5:
            return HighlightChip(
                text="MACD Bearish",
                category="bearish",
                priority=85,
                indicator="macd_12_26_9",
            )
    return None


def _check_stoch_extremes(output: IndicatorOutput) -> HighlightChip | None:
    """Check for Stochastic extreme conditions."""
    raw = output["raw"]
    k = raw.get("k")

    if k is None or k != k:  # NaN check
        return None

    if k <= 15:
        return HighlightChip(
            text="Stoch Oversold",
            category="bullish",
            priority=75,
            indicator="stoch_14_3_3",
        )
    elif k >= 85:
        return HighlightChip(
            text="Stoch Overbought",
            category="bearish",
            priority=75,
            indicator="stoch_14_3_3",
        )
    return None


def _check_adx_trend(output: IndicatorOutput) -> HighlightChip | None:
    """Check for strong ADX trend."""
    raw = output["raw"]
    adx = raw.get("adx")
    plus_di = raw.get("plus_di")
    minus_di = raw.get("minus_di")

    if adx is None or plus_di is None or minus_di is None:
        return None
    if adx != adx:  # NaN check
        return None

    if adx >= 35:
        if plus_di > minus_di:
            return HighlightChip(
                text="Strong Uptrend",
                category="bullish",
                priority=95,
                indicator="adx_14",
            )
        else:
            return HighlightChip(
                text="Strong Downtrend",
                category="bearish",
                priority=95,
                indicator="adx_14",
            )
    elif adx < 20:
        return HighlightChip(
            text="No Trend",
            category="neutral",
            priority=50,
            indicator="adx_14",
        )
    return None


def _check_obv_divergence(output: IndicatorOutput) -> HighlightChip | None:
    """Check for OBV slope signals."""
    raw = output["raw"]
    slope_normalized = raw.get("slope_normalized")

    if slope_normalized is None or slope_normalized != slope_normalized:
        return None

    if slope_normalized > 3:
        return HighlightChip(
            text="Strong Buying",
            category="bullish",
            priority=80,
            indicator="obv",
        )
    elif slope_normalized < -3:
        return HighlightChip(
            text="Strong Selling",
            category="bearish",
            priority=80,
            indicator="obv",
        )
    return None


def _check_bollinger_squeeze(output: IndicatorOutput) -> HighlightChip | None:
    """Check for Bollinger Band conditions."""
    raw = output["raw"]
    percent_b = raw.get("percent_b")
    bandwidth = raw.get("bandwidth")

    if percent_b is None or percent_b != percent_b:
        return None

    # Price at band extremes
    if percent_b <= 0:
        return HighlightChip(
            text="Below BB Lower",
            category="bullish",
            priority=70,
            indicator="bbands_20_2",
        )
    elif percent_b >= 1:
        return HighlightChip(
            text="Above BB Upper",
            category="bearish",
            priority=70,
            indicator="bbands_20_2",
        )

    # Low bandwidth = squeeze (potential breakout)
    if bandwidth is not None and bandwidth == bandwidth:
        if bandwidth < 3:  # Very tight bands
            return HighlightChip(
                text="BB Squeeze",
                category="info",
                priority=65,
                indicator="bbands_20_2",
            )

    return None


def _check_ema_alignment(
    ema_20: IndicatorOutput | None,
    ema_50: IndicatorOutput | None,
    ema_200: IndicatorOutput | None,
) -> HighlightChip | None:
    """Check for EMA alignment (golden/death cross conditions)."""
    if ema_20 is None or ema_50 is None or ema_200 is None:
        return None

    pct_20 = ema_20["raw"].get("price_vs_ema_pct")
    pct_50 = ema_50["raw"].get("price_vs_ema_pct")
    pct_200 = ema_200["raw"].get("price_vs_ema_pct")

    if pct_20 is None or pct_50 is None or pct_200 is None:
        return None
    if pct_20 != pct_20 or pct_50 != pct_50 or pct_200 != pct_200:
        return None

    # All EMAs bullish aligned (price > all EMAs)
    if pct_20 > 0 and pct_50 > 0 and pct_200 > 0:
        return HighlightChip(
            text="EMA Bullish",
            category="bullish",
            priority=88,
            indicator="ema_200",
        )
    # All EMAs bearish aligned (price < all EMAs)
    elif pct_20 < 0 and pct_50 < 0 and pct_200 < 0:
        return HighlightChip(
            text="EMA Bearish",
            category="bearish",
            priority=88,
            indicator="ema_200",
        )
    # Price between short and long EMAs (mixed)
    elif pct_20 > 0 and pct_200 < 0:
        return HighlightChip(
            text="EMA Transition",
            category="info",
            priority=60,
            indicator="ema_50",
        )

    return None


def generate_highlights(
    indicators: dict[str, IndicatorOutput],
    max_chips: int = 4,
) -> list[HighlightChip]:
    """Generate highlight chips from indicator outputs.

    Args:
        indicators: Dict of indicator outputs from registry.compute_all().
        max_chips: Maximum number of chips to return (default 4).

    Returns:
        List of HighlightChip objects, sorted by priority descending.
    """
    chips: list[HighlightChip] = []

    # Check each indicator for highlight conditions
    if "rsi_14" in indicators:
        chip = _check_rsi_extremes(indicators["rsi_14"])
        if chip:
            chips.append(chip)

    if "macd_12_26_9" in indicators:
        chip = _check_macd_cross(indicators["macd_12_26_9"])
        if chip:
            chips.append(chip)

    if "stoch_14_3_3" in indicators:
        chip = _check_stoch_extremes(indicators["stoch_14_3_3"])
        if chip:
            chips.append(chip)

    if "adx_14" in indicators:
        chip = _check_adx_trend(indicators["adx_14"])
        if chip:
            chips.append(chip)

    if "obv" in indicators:
        chip = _check_obv_divergence(indicators["obv"])
        if chip:
            chips.append(chip)

    if "bbands_20_2" in indicators:
        chip = _check_bollinger_squeeze(indicators["bbands_20_2"])
        if chip:
            chips.append(chip)

    # EMA alignment check (uses all 3 EMAs together)
    ema_chip = _check_ema_alignment(
        indicators.get("ema_20"),
        indicators.get("ema_50"),
        indicators.get("ema_200"),
    )
    if ema_chip:
        chips.append(ema_chip)

    # Sort by priority (highest first) and take top N
    chips.sort(key=lambda c: c.priority, reverse=True)
    return chips[:max_chips]


def chips_to_list(chips: list[HighlightChip]) -> list[dict]:
    """Convert chips to serializable list of dicts.

    Args:
        chips: List of HighlightChip objects.

    Returns:
        List of dicts suitable for JSON serialization.
    """
    return [
        {
            "text": chip.text,
            "category": chip.category,
            "indicator": chip.indicator,
        }
        for chip in chips
    ]
