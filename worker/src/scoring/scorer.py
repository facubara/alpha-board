"""Bullish score computation from indicator signals.

The BullishScorer computes a composite bullish score [0, 1] from
weighted indicator signals [-1, +1].
"""

from typing import Any

import numpy as np

from src.indicators.registry import IndicatorOutput


class BullishScorer:
    """Computes composite bullish score from indicator signals.

    The bullish score is a weighted average of normalized signals,
    rescaled from [-1, +1] to [0, 1]:
    - 0.0 = maximally bearish (all indicators at -1)
    - 0.5 = neutral (balanced signals)
    - 1.0 = maximally bullish (all indicators at +1)
    """

    def score(self, indicators: dict[str, IndicatorOutput]) -> float:
        """Compute bullish score from indicator outputs.

        Args:
            indicators: Dict mapping indicator name to IndicatorOutput.
                       Each output contains 'weight' and 'signal' with 'signal' value.

        Returns:
            Bullish score in range [0, 1].
            Returns 0.5 (neutral) if no valid indicators.
        """
        if not indicators:
            return 0.5

        weighted_sum = 0.0
        total_weight = 0.0

        for name, output in indicators.items():
            signal_value = output["signal"]["signal"]
            weight = output["weight"]

            # Skip NaN signals
            if np.isnan(signal_value):
                continue

            weighted_sum += signal_value * weight
            total_weight += weight

        if total_weight == 0:
            return 0.5

        # Weighted average in [-1, +1]
        weighted_avg = weighted_sum / total_weight

        # Rescale from [-1, +1] to [0, 1]
        bullish_score = (weighted_avg + 1) / 2

        # Clamp to valid range (in case of floating point errors)
        return float(np.clip(bullish_score, 0.0, 1.0))

    def score_with_details(
        self, indicators: dict[str, IndicatorOutput]
    ) -> dict[str, Any]:
        """Compute bullish score with detailed breakdown.

        Args:
            indicators: Dict mapping indicator name to IndicatorOutput.

        Returns:
            Dict with:
            - bullish_score: The composite score [0, 1]
            - weighted_avg: The weighted average signal [-1, +1]
            - valid_indicators: Number of indicators with valid signals
            - total_indicators: Total number of indicators
            - signal_breakdown: Per-indicator signal values and contributions
        """
        if not indicators:
            return {
                "bullish_score": 0.5,
                "weighted_avg": 0.0,
                "valid_indicators": 0,
                "total_indicators": 0,
                "signal_breakdown": {},
            }

        weighted_sum = 0.0
        total_weight = 0.0
        valid_count = 0
        breakdown: dict[str, dict[str, float]] = {}

        for name, output in indicators.items():
            signal_value = output["signal"]["signal"]
            weight = output["weight"]

            breakdown[name] = {
                "signal": signal_value,
                "weight": weight,
                "contribution": 0.0,
            }

            if np.isnan(signal_value):
                continue

            contribution = signal_value * weight
            weighted_sum += contribution
            total_weight += weight
            valid_count += 1
            breakdown[name]["contribution"] = contribution

        if total_weight == 0:
            weighted_avg = 0.0
            bullish_score = 0.5
        else:
            weighted_avg = weighted_sum / total_weight
            bullish_score = (weighted_avg + 1) / 2

        return {
            "bullish_score": float(np.clip(bullish_score, 0.0, 1.0)),
            "weighted_avg": float(weighted_avg),
            "valid_indicators": valid_count,
            "total_indicators": len(indicators),
            "signal_breakdown": breakdown,
        }


# Default scorer instance
default_scorer = BullishScorer()
