"""Confidence score computation for ranking reliability.

The ConfidenceScorer evaluates how reliable a bullish score is based on:
- Signal agreement (60%): Do indicators agree with each other?
- Data completeness (25%): Are all indicators available?
- Volume adequacy (15%): Does the symbol have sufficient trading volume?
"""

from typing import Any

import numpy as np

from src.indicators.registry import IndicatorOutput


class ConfidenceScorer:
    """Computes confidence score for ranking reliability.

    The confidence score [0, 1] indicates how reliable the bullish score is:
    - High confidence: Indicators agree, all data available, good volume
    - Low confidence: Conflicting signals, missing data, or low volume

    Components:
    - Signal agreement (60%): Low std deviation of signals = high agreement
    - Data completeness (25%): Percentage of indicators with valid values
    - Volume adequacy (15%): Volume percentile rank among all symbols
    """

    # Component weights (must sum to 1.0)
    AGREEMENT_WEIGHT = 0.60
    COMPLETENESS_WEIGHT = 0.25
    VOLUME_WEIGHT = 0.15

    def __init__(
        self,
        expected_indicators: int = 9,
        volume_high_percentile: float = 0.8,
    ):
        """Initialize the confidence scorer.

        Args:
            expected_indicators: Number of indicators expected (default 9).
            volume_high_percentile: Volume percentile for full volume score.
        """
        self.expected_indicators = expected_indicators
        self.volume_high_percentile = volume_high_percentile

    def compute_agreement(self, indicators: dict[str, IndicatorOutput]) -> float:
        """Compute signal agreement score based on standard deviation.

        High agreement (low std) = signals pointing same direction.
        Low agreement (high std) = conflicting signals.

        Args:
            indicators: Dict of indicator outputs.

        Returns:
            Agreement score [0, 1]. Returns 1.0 if < 2 valid signals.
        """
        signals = []
        for output in indicators.values():
            signal = output["signal"]["signal"]
            if not np.isnan(signal):
                signals.append(signal)

        if len(signals) < 2:
            return 1.0  # Can't measure agreement with < 2 signals

        # Standard deviation of signals (range is [-1, 1], so max std ≈ 1.0)
        std = float(np.std(signals))

        # Convert to agreement score: low std = high agreement
        # std of 0 = perfect agreement (score 1.0)
        # std of 1 = maximum disagreement (score 0.0)
        agreement = 1.0 - min(std, 1.0)

        return agreement

    def compute_completeness(self, indicators: dict[str, IndicatorOutput]) -> float:
        """Compute data completeness score.

        Args:
            indicators: Dict of indicator outputs.

        Returns:
            Completeness score [0, 1].
        """
        if self.expected_indicators == 0:
            return 1.0

        valid_count = 0
        for output in indicators.values():
            signal = output["signal"]["signal"]
            if not np.isnan(signal):
                valid_count += 1

        return valid_count / self.expected_indicators

    def compute_volume_adequacy(
        self,
        symbol_volume: float,
        all_volumes: list[float] | None = None,
        volume_percentile: float | None = None,
    ) -> float:
        """Compute volume adequacy score.

        Can be called with either:
        - all_volumes: List of all symbol volumes to compute percentile
        - volume_percentile: Pre-computed percentile rank [0, 1]

        Args:
            symbol_volume: 24h quote volume for this symbol.
            all_volumes: Optional list of all symbol volumes.
            volume_percentile: Optional pre-computed percentile.

        Returns:
            Volume adequacy score [0, 1].
        """
        if volume_percentile is not None:
            # Use pre-computed percentile
            pct = volume_percentile
        elif all_volumes and len(all_volumes) > 0:
            # Compute percentile rank
            below_count = sum(1 for v in all_volumes if v < symbol_volume)
            pct = below_count / len(all_volumes)
        else:
            # No volume data, return neutral
            return 0.5

        # Scale so that high_percentile gives full score
        # Below that, scale linearly
        if pct >= self.volume_high_percentile:
            return 1.0
        else:
            return pct / self.volume_high_percentile

    def score(
        self,
        indicators: dict[str, IndicatorOutput],
        symbol_volume: float = 0.0,
        volume_percentile: float | None = None,
    ) -> float:
        """Compute overall confidence score.

        Args:
            indicators: Dict of indicator outputs.
            symbol_volume: 24h quote volume (used if volume_percentile not provided).
            volume_percentile: Pre-computed volume percentile [0, 1].

        Returns:
            Confidence score [0, 1].
        """
        agreement = self.compute_agreement(indicators)
        completeness = self.compute_completeness(indicators)
        volume = self.compute_volume_adequacy(
            symbol_volume, volume_percentile=volume_percentile
        )

        confidence = (
            agreement * self.AGREEMENT_WEIGHT
            + completeness * self.COMPLETENESS_WEIGHT
            + volume * self.VOLUME_WEIGHT
        )

        return float(np.clip(confidence, 0.0, 1.0))

    def score_with_details(
        self,
        indicators: dict[str, IndicatorOutput],
        symbol_volume: float = 0.0,
        volume_percentile: float | None = None,
    ) -> dict[str, Any]:
        """Compute confidence score with component breakdown.

        Args:
            indicators: Dict of indicator outputs.
            symbol_volume: 24h quote volume.
            volume_percentile: Pre-computed volume percentile [0, 1].

        Returns:
            Dict with confidence score and component details.
        """
        agreement = self.compute_agreement(indicators)
        completeness = self.compute_completeness(indicators)
        volume = self.compute_volume_adequacy(
            symbol_volume, volume_percentile=volume_percentile
        )

        confidence = (
            agreement * self.AGREEMENT_WEIGHT
            + completeness * self.COMPLETENESS_WEIGHT
            + volume * self.VOLUME_WEIGHT
        )

        return {
            "confidence": float(np.clip(confidence, 0.0, 1.0)),
            "components": {
                "agreement": {
                    "score": agreement,
                    "weight": self.AGREEMENT_WEIGHT,
                    "contribution": agreement * self.AGREEMENT_WEIGHT,
                },
                "completeness": {
                    "score": completeness,
                    "weight": self.COMPLETENESS_WEIGHT,
                    "contribution": completeness * self.COMPLETENESS_WEIGHT,
                },
                "volume": {
                    "score": volume,
                    "weight": self.VOLUME_WEIGHT,
                    "contribution": volume * self.VOLUME_WEIGHT,
                },
            },
        }


# Default scorer instance
default_confidence_scorer = ConfidenceScorer()
