"""Technical indicator computation functions using pandas-ta.

All functions take an OHLCVDataFrame and return the latest indicator values.
The DataFrame must have columns: open, high, low, close, volume.
"""

from typing import TypedDict

import numpy as np
import pandas as pd
import pandas_ta as ta


class RSIResult(TypedDict):
    """RSI computation result."""

    value: float


class MACDResult(TypedDict):
    """MACD computation result."""

    macd: float
    signal: float
    histogram: float


class StochasticResult(TypedDict):
    """Stochastic oscillator result."""

    k: float
    d: float


class ADXResult(TypedDict):
    """ADX computation result."""

    adx: float
    plus_di: float
    minus_di: float


class OBVResult(TypedDict):
    """OBV computation result."""

    obv: float
    slope: float
    slope_normalized: float


class BollingerResult(TypedDict):
    """Bollinger Bands result."""

    upper: float
    middle: float
    lower: float
    bandwidth: float
    percent_b: float  # Position within bands (0-1, can exceed)


class EMAResult(TypedDict):
    """EMA computation result."""

    ema: float
    price_vs_ema_pct: float  # Percentage above/below EMA


def compute_rsi(df: pd.DataFrame, period: int = 14) -> RSIResult:
    """Compute Relative Strength Index.

    Args:
        df: OHLCV DataFrame with 'close' column.
        period: RSI lookback period (default 14).

    Returns:
        RSIResult with the latest RSI value (0-100 scale).
    """
    if len(df) < period + 1:
        return {"value": np.nan}

    rsi = ta.rsi(df["close"], length=period)
    if rsi is None or rsi.empty:
        return {"value": np.nan}

    value = rsi.iloc[-1]
    return {"value": float(value) if not pd.isna(value) else np.nan}


def compute_macd(
    df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9
) -> MACDResult:
    """Compute MACD (Moving Average Convergence Divergence).

    Args:
        df: OHLCV DataFrame with 'close' column.
        fast: Fast EMA period (default 12).
        slow: Slow EMA period (default 26).
        signal: Signal line period (default 9).

    Returns:
        MACDResult with macd line, signal line, and histogram values.
    """
    if len(df) < slow + signal:
        return {"macd": np.nan, "signal": np.nan, "histogram": np.nan}

    macd_df = ta.macd(df["close"], fast=fast, slow=slow, signal=signal)
    if macd_df is None or macd_df.empty:
        return {"macd": np.nan, "signal": np.nan, "histogram": np.nan}

    # pandas-ta returns columns like MACD_12_26_9, MACDh_12_26_9, MACDs_12_26_9
    macd_col = f"MACD_{fast}_{slow}_{signal}"
    signal_col = f"MACDs_{fast}_{slow}_{signal}"
    hist_col = f"MACDh_{fast}_{slow}_{signal}"

    macd_val = macd_df[macd_col].iloc[-1] if macd_col in macd_df.columns else np.nan
    signal_val = macd_df[signal_col].iloc[-1] if signal_col in macd_df.columns else np.nan
    hist_val = macd_df[hist_col].iloc[-1] if hist_col in macd_df.columns else np.nan

    return {
        "macd": float(macd_val) if not pd.isna(macd_val) else np.nan,
        "signal": float(signal_val) if not pd.isna(signal_val) else np.nan,
        "histogram": float(hist_val) if not pd.isna(hist_val) else np.nan,
    }


def compute_stochastic(
    df: pd.DataFrame, k: int = 14, d: int = 3, smooth: int = 3
) -> StochasticResult:
    """Compute Stochastic Oscillator.

    Args:
        df: OHLCV DataFrame with 'high', 'low', 'close' columns.
        k: %K lookback period (default 14).
        d: %D smoothing period (default 3).
        smooth: %K smoothing (default 3).

    Returns:
        StochasticResult with %K and %D values (0-100 scale).
    """
    if len(df) < k + d + smooth:
        return {"k": np.nan, "d": np.nan}

    stoch = ta.stoch(df["high"], df["low"], df["close"], k=k, d=d, smooth_k=smooth)
    if stoch is None or stoch.empty:
        return {"k": np.nan, "d": np.nan}

    # pandas-ta returns columns like STOCHk_14_3_3, STOCHd_14_3_3
    k_col = f"STOCHk_{k}_{d}_{smooth}"
    d_col = f"STOCHd_{k}_{d}_{smooth}"

    k_val = stoch[k_col].iloc[-1] if k_col in stoch.columns else np.nan
    d_val = stoch[d_col].iloc[-1] if d_col in stoch.columns else np.nan

    return {
        "k": float(k_val) if not pd.isna(k_val) else np.nan,
        "d": float(d_val) if not pd.isna(d_val) else np.nan,
    }


def compute_adx(df: pd.DataFrame, period: int = 14) -> ADXResult:
    """Compute Average Directional Index.

    Args:
        df: OHLCV DataFrame with 'high', 'low', 'close' columns.
        period: ADX lookback period (default 14).

    Returns:
        ADXResult with ADX, +DI, and -DI values.
    """
    if len(df) < period * 2:
        return {"adx": np.nan, "plus_di": np.nan, "minus_di": np.nan}

    adx_df = ta.adx(df["high"], df["low"], df["close"], length=period)
    if adx_df is None or adx_df.empty:
        return {"adx": np.nan, "plus_di": np.nan, "minus_di": np.nan}

    # pandas-ta returns columns like ADX_14, DMP_14, DMN_14
    adx_col = f"ADX_{period}"
    dmp_col = f"DMP_{period}"
    dmn_col = f"DMN_{period}"

    adx_val = adx_df[adx_col].iloc[-1] if adx_col in adx_df.columns else np.nan
    plus_di = adx_df[dmp_col].iloc[-1] if dmp_col in adx_df.columns else np.nan
    minus_di = adx_df[dmn_col].iloc[-1] if dmn_col in adx_df.columns else np.nan

    return {
        "adx": float(adx_val) if not pd.isna(adx_val) else np.nan,
        "plus_di": float(plus_di) if not pd.isna(plus_di) else np.nan,
        "minus_di": float(minus_di) if not pd.isna(minus_di) else np.nan,
    }


def compute_obv(df: pd.DataFrame, slope_period: int = 10) -> OBVResult:
    """Compute On-Balance Volume with slope.

    Args:
        df: OHLCV DataFrame with 'close' and 'volume' columns.
        slope_period: Period for slope calculation (default 10).

    Returns:
        OBVResult with OBV value, slope, and normalized slope.
    """
    if len(df) < slope_period + 1:
        return {"obv": np.nan, "slope": np.nan, "slope_normalized": np.nan}

    obv = ta.obv(df["close"], df["volume"])
    if obv is None or obv.empty:
        return {"obv": np.nan, "slope": np.nan, "slope_normalized": np.nan}

    obv_val = obv.iloc[-1]

    # Calculate slope over the slope_period using linear regression
    if len(obv) >= slope_period:
        recent_obv = obv.iloc[-slope_period:]
        x = np.arange(slope_period)
        slope, _ = np.polyfit(x, recent_obv.values, 1)

        # Normalize slope by average OBV to get percentage change per period
        avg_obv = abs(recent_obv.mean())
        slope_normalized = (slope / avg_obv * 100) if avg_obv > 0 else 0.0
    else:
        slope = np.nan
        slope_normalized = np.nan

    return {
        "obv": float(obv_val) if not pd.isna(obv_val) else np.nan,
        "slope": float(slope) if not pd.isna(slope) else np.nan,
        "slope_normalized": float(slope_normalized) if not pd.isna(slope_normalized) else np.nan,
    }


def compute_bollinger(df: pd.DataFrame, period: int = 20, std: float = 2.0) -> BollingerResult:
    """Compute Bollinger Bands.

    Args:
        df: OHLCV DataFrame with 'close' column.
        period: Moving average period (default 20).
        std: Standard deviation multiplier (default 2.0).

    Returns:
        BollingerResult with upper, middle, lower bands, bandwidth, and %B.
    """
    if len(df) < period:
        return {
            "upper": np.nan,
            "middle": np.nan,
            "lower": np.nan,
            "bandwidth": np.nan,
            "percent_b": np.nan,
        }

    bbands = ta.bbands(df["close"], length=period, std=std)
    if bbands is None or bbands.empty:
        return {
            "upper": np.nan,
            "middle": np.nan,
            "lower": np.nan,
            "bandwidth": np.nan,
            "percent_b": np.nan,
        }

    # Find columns dynamically (pandas-ta naming varies by version)
    cols = bbands.columns.tolist()
    lower_col = next((c for c in cols if c.startswith("BBL_")), None)
    mid_col = next((c for c in cols if c.startswith("BBM_")), None)
    upper_col = next((c for c in cols if c.startswith("BBU_")), None)
    bandwidth_col = next((c for c in cols if c.startswith("BBB_")), None)
    percent_b_col = next((c for c in cols if c.startswith("BBP_")), None)

    upper = bbands[upper_col].iloc[-1] if upper_col else np.nan
    middle = bbands[mid_col].iloc[-1] if mid_col else np.nan
    lower = bbands[lower_col].iloc[-1] if lower_col else np.nan
    bandwidth = bbands[bandwidth_col].iloc[-1] if bandwidth_col else np.nan
    percent_b = bbands[percent_b_col].iloc[-1] if percent_b_col else np.nan

    return {
        "upper": float(upper) if not pd.isna(upper) else np.nan,
        "middle": float(middle) if not pd.isna(middle) else np.nan,
        "lower": float(lower) if not pd.isna(lower) else np.nan,
        "bandwidth": float(bandwidth) if not pd.isna(bandwidth) else np.nan,
        "percent_b": float(percent_b) if not pd.isna(percent_b) else np.nan,
    }


def compute_ema(df: pd.DataFrame, period: int) -> EMAResult:
    """Compute Exponential Moving Average.

    Args:
        df: OHLCV DataFrame with 'close' column.
        period: EMA period.

    Returns:
        EMAResult with EMA value and price vs EMA percentage.
    """
    if len(df) < period:
        return {"ema": np.nan, "price_vs_ema_pct": np.nan}

    ema = ta.ema(df["close"], length=period)
    if ema is None or ema.empty:
        return {"ema": np.nan, "price_vs_ema_pct": np.nan}

    ema_val = ema.iloc[-1]
    current_price = df["close"].iloc[-1]

    # Calculate percentage above/below EMA
    if not pd.isna(ema_val) and ema_val > 0:
        price_vs_ema_pct = ((current_price - ema_val) / ema_val) * 100
    else:
        price_vs_ema_pct = np.nan

    return {
        "ema": float(ema_val) if not pd.isna(ema_val) else np.nan,
        "price_vs_ema_pct": float(price_vs_ema_pct) if not pd.isna(price_vs_ema_pct) else np.nan,
    }
