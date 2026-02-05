"""Signal normalization functions for technical indicators.

Converts raw indicator values to normalized signals in the range [-1, +1]:
- +1.0 = strongly bullish
- +0.5 = moderately bullish
-  0.0 = neutral
- -0.5 = moderately bearish
- -1.0 = strongly bearish

Signal interpretation is indicator-specific and uses configurable thresholds.
"""

from typing import Any, TypedDict

import numpy as np

from src.indicators.compute import (
    ADXResult,
    BollingerResult,
    EMAResult,
    MACDResult,
    OBVResult,
    RSIResult,
    StochasticResult,
)


class SignalResult(TypedDict):
    """Normalized signal result."""

    signal: float  # -1 to +1
    label: str  # "bullish", "bearish", "neutral"
    strength: str  # "strong", "moderate", "weak"


def _classify_signal(signal: float) -> tuple[str, str]:
    """Classify signal into label and strength.

    Args:
        signal: Normalized signal value (-1 to +1).

    Returns:
        Tuple of (label, strength).
    """
    if np.isnan(signal):
        return ("neutral", "weak")

    abs_signal = abs(signal)

    if abs_signal < 0.2:
        strength = "weak"
    elif abs_signal < 0.6:
        strength = "moderate"
    else:
        strength = "strong"

    if signal > 0.1:
        label = "bullish"
    elif signal < -0.1:
        label = "bearish"
    else:
        label = "neutral"

    return (label, strength)


def normalize_rsi(result: RSIResult, config: dict[str, Any]) -> SignalResult:
    """Normalize RSI to signal.

    RSI interpretation:
    - Below oversold (30): bullish (oversold = buy opportunity)
    - Above overbought (70): bearish (overbought = sell signal)
    - Between: linear interpolation

    Args:
        result: RSI computation result.
        config: Indicator config with 'oversold' and 'overbought' thresholds.

    Returns:
        Normalized signal.
    """
    value = result["value"]
    if np.isnan(value):
        return {"signal": 0.0, "label": "neutral", "strength": "weak"}

    oversold = config.get("oversold", 30)
    overbought = config.get("overbought", 70)
    midpoint = (oversold + overbought) / 2

    # RSI below oversold = bullish (reversal expected)
    # RSI above overbought = bearish (reversal expected)
    if value <= oversold:
        # Scale from 0 (at oversold) to +1 (at 0)
        signal = (oversold - value) / oversold
    elif value >= overbought:
        # Scale from 0 (at overbought) to -1 (at 100)
        signal = -(value - overbought) / (100 - overbought)
    else:
        # Between oversold and overbought: linear scale from +0.5 to -0.5
        signal = (midpoint - value) / (overbought - oversold)

    signal = np.clip(signal, -1.0, 1.0)
    label, strength = _classify_signal(signal)
    return {"signal": float(signal), "label": label, "strength": strength}


def normalize_macd(result: MACDResult, config: dict[str, Any]) -> SignalResult:
    """Normalize MACD to signal.

    MACD interpretation:
    - Positive histogram (MACD > signal): bullish momentum
    - Negative histogram (MACD < signal): bearish momentum
    - Magnitude indicates strength

    Args:
        result: MACD computation result.
        config: Indicator config (unused, kept for consistency).

    Returns:
        Normalized signal.
    """
    histogram = result["histogram"]
    macd = result["macd"]

    if np.isnan(histogram) or np.isnan(macd):
        return {"signal": 0.0, "label": "neutral", "strength": "weak"}

    # Use histogram sign and normalize by MACD magnitude
    # This creates a relative measure of momentum
    if abs(macd) > 0:
        # Histogram as percentage of MACD line magnitude
        relative_hist = histogram / abs(macd)
        signal = np.clip(relative_hist, -1.0, 1.0)
    else:
        signal = np.sign(histogram) * 0.5 if histogram != 0 else 0.0

    label, strength = _classify_signal(signal)
    return {"signal": float(signal), "label": label, "strength": strength}


def normalize_stochastic(result: StochasticResult, config: dict[str, Any]) -> SignalResult:
    """Normalize Stochastic oscillator to signal.

    Stochastic interpretation (similar to RSI):
    - %K below 20: oversold = bullish
    - %K above 80: overbought = bearish
    - %K crossing %D provides additional signal

    Args:
        result: Stochastic computation result.
        config: Indicator config.

    Returns:
        Normalized signal.
    """
    k = result["k"]
    d = result["d"]

    if np.isnan(k):
        return {"signal": 0.0, "label": "neutral", "strength": "weak"}

    oversold = 20
    overbought = 80
    midpoint = 50

    # Base signal from %K level (similar to RSI)
    if k <= oversold:
        level_signal = (oversold - k) / oversold
    elif k >= overbought:
        level_signal = -(k - overbought) / (100 - overbought)
    else:
        level_signal = (midpoint - k) / (overbought - oversold) * 0.5

    # Boost signal if %K > %D (bullish crossover indication)
    cross_boost = 0.0
    if not np.isnan(d):
        cross_boost = np.clip((k - d) / 20, -0.3, 0.3)

    signal = np.clip(level_signal + cross_boost, -1.0, 1.0)
    label, strength = _classify_signal(signal)
    return {"signal": float(signal), "label": label, "strength": strength}


def normalize_adx(result: ADXResult, config: dict[str, Any]) -> SignalResult:
    """Normalize ADX to signal.

    ADX interpretation:
    - ADX measures trend strength, not direction
    - Direction comes from +DI vs -DI comparison
    - ADX > threshold: strong trend
    - +DI > -DI: bullish trend
    - -DI > +DI: bearish trend

    Args:
        result: ADX computation result.
        config: Indicator config with 'trend_threshold'.

    Returns:
        Normalized signal.
    """
    adx = result["adx"]
    plus_di = result["plus_di"]
    minus_di = result["minus_di"]

    if np.isnan(adx) or np.isnan(plus_di) or np.isnan(minus_di):
        return {"signal": 0.0, "label": "neutral", "strength": "weak"}

    threshold = config.get("trend_threshold", 25)

    # Direction from DI difference
    di_diff = plus_di - minus_di
    direction = np.sign(di_diff)

    # Strength from ADX level
    if adx < threshold:
        # Weak trend, reduce signal magnitude
        trend_strength = adx / threshold * 0.5
    else:
        # Strong trend, full signal
        trend_strength = 0.5 + (adx - threshold) / (100 - threshold) * 0.5

    # Combine direction and strength
    # Also factor in DI separation for confidence
    di_separation = abs(di_diff) / (plus_di + minus_di + 1) * 2

    signal = direction * trend_strength * np.clip(di_separation, 0.5, 1.0)
    signal = np.clip(signal, -1.0, 1.0)

    label, strength = _classify_signal(signal)
    return {"signal": float(signal), "label": label, "strength": strength}


def normalize_obv(result: OBVResult, config: dict[str, Any]) -> SignalResult:
    """Normalize OBV to signal.

    OBV interpretation:
    - Rising OBV (positive slope): buying pressure = bullish
    - Falling OBV (negative slope): selling pressure = bearish
    - Uses normalized slope (percentage change per period)

    Args:
        result: OBV computation result.
        config: Indicator config.

    Returns:
        Normalized signal.
    """
    slope_normalized = result["slope_normalized"]

    if np.isnan(slope_normalized):
        return {"signal": 0.0, "label": "neutral", "strength": "weak"}

    # Normalize slope: typical range is roughly -5% to +5% per period
    # Scale to -1 to +1
    signal = np.clip(slope_normalized / 5.0, -1.0, 1.0)

    label, strength = _classify_signal(signal)
    return {"signal": float(signal), "label": label, "strength": strength}


def normalize_bollinger(result: BollingerResult, config: dict[str, Any]) -> SignalResult:
    """Normalize Bollinger Bands to signal.

    Bollinger interpretation:
    - %B < 0 (below lower band): oversold = bullish
    - %B > 1 (above upper band): overbought = bearish
    - %B around 0.5: neutral

    Also considers bandwidth for volatility context.

    Args:
        result: Bollinger computation result.
        config: Indicator config.

    Returns:
        Normalized signal.
    """
    percent_b = result["percent_b"]

    if np.isnan(percent_b):
        return {"signal": 0.0, "label": "neutral", "strength": "weak"}

    # %B interpretation:
    # 0 = at lower band, 1 = at upper band
    # < 0 = below lower band (oversold), > 1 = above upper band (overbought)

    if percent_b <= 0:
        # Below lower band: bullish (oversold)
        signal = min(1.0, 0.5 + abs(percent_b) * 0.5)
    elif percent_b >= 1:
        # Above upper band: bearish (overbought)
        signal = max(-1.0, -0.5 - (percent_b - 1) * 0.5)
    elif percent_b < 0.3:
        # Near lower band: moderately bullish
        signal = (0.3 - percent_b) / 0.3 * 0.5
    elif percent_b > 0.7:
        # Near upper band: moderately bearish
        signal = -(percent_b - 0.7) / 0.3 * 0.5
    else:
        # Middle zone: neutral to slight bias
        signal = (0.5 - percent_b) * 0.3

    signal = np.clip(signal, -1.0, 1.0)
    label, strength = _classify_signal(signal)
    return {"signal": float(signal), "label": label, "strength": strength}


def normalize_ema(result: EMAResult, config: dict[str, Any]) -> SignalResult:
    """Normalize EMA to signal.

    EMA interpretation:
    - Price above EMA: bullish
    - Price below EMA: bearish
    - Distance from EMA indicates strength

    Uses neutral_pct threshold from config to define the neutral zone.

    Args:
        result: EMA computation result.
        config: Indicator config with 'neutral_pct'.

    Returns:
        Normalized signal.
    """
    pct = result["price_vs_ema_pct"]

    if np.isnan(pct):
        return {"signal": 0.0, "label": "neutral", "strength": "weak"}

    neutral_pct = config.get("neutral_pct", 1.0)

    # Scale percentage to signal
    # Within neutral_pct: weak signal
    # Beyond neutral_pct: stronger signal

    if abs(pct) <= neutral_pct:
        # Within neutral zone
        signal = pct / neutral_pct * 0.3
    else:
        # Beyond neutral zone
        excess = abs(pct) - neutral_pct
        base_signal = 0.3 * np.sign(pct)
        additional = np.clip(excess / (neutral_pct * 3), 0, 0.7) * np.sign(pct)
        signal = base_signal + additional

    signal = np.clip(signal, -1.0, 1.0)
    label, strength = _classify_signal(signal)
    return {"signal": float(signal), "label": label, "strength": strength}


# Mapping of indicator names to normalization functions
NORMALIZERS = {
    "rsi_14": normalize_rsi,
    "macd_12_26_9": normalize_macd,
    "stoch_14_3_3": normalize_stochastic,
    "adx_14": normalize_adx,
    "obv": normalize_obv,
    "bbands_20_2": normalize_bollinger,
    "ema_20": normalize_ema,
    "ema_50": normalize_ema,
    "ema_200": normalize_ema,
}
