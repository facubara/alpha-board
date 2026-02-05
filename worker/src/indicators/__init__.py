"""Technical indicators module for Alpha Board.

Provides computation, signal normalization, and highlight generation
for 9 technical indicators used in the rankings engine.
"""

from src.indicators.compute import (
    ADXResult,
    BollingerResult,
    EMAResult,
    MACDResult,
    OBVResult,
    RSIResult,
    StochasticResult,
    compute_adx,
    compute_bollinger,
    compute_ema,
    compute_macd,
    compute_obv,
    compute_rsi,
    compute_stochastic,
)
from src.indicators.highlights import (
    HighlightChip,
    chips_to_list,
    generate_highlights,
)
from src.indicators.registry import (
    IndicatorDefinition,
    IndicatorOutput,
    IndicatorRegistry,
    create_default_registry,
    default_registry,
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

__all__ = [
    # Compute functions
    "compute_rsi",
    "compute_macd",
    "compute_stochastic",
    "compute_adx",
    "compute_obv",
    "compute_bollinger",
    "compute_ema",
    # Compute result types
    "RSIResult",
    "MACDResult",
    "StochasticResult",
    "ADXResult",
    "OBVResult",
    "BollingerResult",
    "EMAResult",
    # Signal normalization
    "SignalResult",
    "normalize_rsi",
    "normalize_macd",
    "normalize_stochastic",
    "normalize_adx",
    "normalize_obv",
    "normalize_bollinger",
    "normalize_ema",
    # Registry
    "IndicatorRegistry",
    "IndicatorDefinition",
    "IndicatorOutput",
    "create_default_registry",
    "default_registry",
    # Highlights
    "HighlightChip",
    "generate_highlights",
    "chips_to_list",
]
