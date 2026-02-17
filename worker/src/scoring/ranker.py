"""Symbol ranking and snapshot generation.

The Ranker takes scored symbols and produces ranked snapshot rows
ready for database insertion.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from src.indicators.highlights import HighlightChip, chips_to_list, generate_highlights
from src.indicators.registry import IndicatorOutput
from src.scoring.confidence import ConfidenceScorer, default_confidence_scorer
from src.scoring.scorer import BullishScorer, default_scorer


@dataclass
class SymbolData:
    """Input data for a single symbol to be ranked."""

    symbol: str
    symbol_id: int
    indicators: dict[str, IndicatorOutput]
    quote_volume_24h: float = 0.0
    price_change_pct: float | None = None
    volume_change_pct: float | None = None
    price_change_abs: float | None = None
    volume_change_abs: float | None = None
    funding_rate: float | None = None


@dataclass
class RankedSnapshot:
    """A ranked symbol snapshot ready for DB insertion."""

    symbol_id: int
    symbol: str  # For reference, not stored in DB
    timeframe: str
    bullish_score: Decimal
    confidence: int  # 0-100 scale
    rank: int
    highlights: list[dict]
    indicator_signals: dict[str, Any]
    computed_at: datetime


class Ranker:
    """Ranks symbols and produces snapshot rows.

    Takes a list of symbols with their indicator data, computes scores,
    ranks them, and generates snapshot rows for database insertion.
    """

    def __init__(
        self,
        bullish_scorer: BullishScorer | None = None,
        confidence_scorer: ConfidenceScorer | None = None,
    ):
        """Initialize the ranker.

        Args:
            bullish_scorer: Custom bullish scorer (default: default_scorer).
            confidence_scorer: Custom confidence scorer (default: default_confidence_scorer).
        """
        self.bullish_scorer = bullish_scorer or default_scorer
        self.confidence_scorer = confidence_scorer or default_confidence_scorer

    def _compute_volume_percentiles(
        self, symbols: list[SymbolData]
    ) -> dict[str, float]:
        """Compute volume percentile for each symbol.

        Args:
            symbols: List of symbol data.

        Returns:
            Dict mapping symbol to volume percentile [0, 1].
        """
        if not symbols:
            return {}

        volumes = [s.quote_volume_24h for s in symbols]
        sorted_volumes = sorted(volumes)

        percentiles = {}
        for s in symbols:
            # Count how many symbols have lower volume
            below_count = sum(1 for v in sorted_volumes if v < s.quote_volume_24h)
            percentiles[s.symbol] = below_count / len(symbols)

        return percentiles

    @staticmethod
    def _sanitize_for_json(obj: Any) -> Any:
        """Replace NaN/Inf floats with None for valid JSON serialization."""
        if isinstance(obj, float):
            if obj != obj or obj == float("inf") or obj == float("-inf"):
                return None
            return obj
        if isinstance(obj, dict):
            return {k: Ranker._sanitize_for_json(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [Ranker._sanitize_for_json(v) for v in obj]
        return obj

    def _extract_indicator_signals(
        self, indicators: dict[str, IndicatorOutput]
    ) -> dict[str, Any]:
        """Extract indicator signals for JSONB storage.

        Args:
            indicators: Dict of indicator outputs.

        Returns:
            Dict with signal data for each indicator.
        """
        signals = {}
        for name, output in indicators.items():
            sig = output["signal"]
            signals[name] = {
                "signal": sig["signal"],
                "label": sig["label"],
                "strength": sig["strength"],
                "weight": output["weight"],
                "category": output["category"],
                "raw": self._sanitize_for_json(output["raw"]),
            }
        return signals

    def rank(
        self,
        symbols: list[SymbolData],
        timeframe: str,
        run_id: UUID | None = None,
        computed_at: datetime | None = None,
    ) -> list[RankedSnapshot]:
        """Rank symbols and generate snapshot rows.

        Args:
            symbols: List of symbol data with indicators.
            timeframe: Timeframe being ranked (e.g., "1h").
            run_id: Optional computation run ID.
            computed_at: Optional timestamp (default: now).

        Returns:
            List of RankedSnapshot objects sorted by rank ascending.
        """
        if not symbols:
            return []

        computed_at = computed_at or datetime.now(timezone.utc)

        # Compute volume percentiles for confidence scoring
        volume_percentiles = self._compute_volume_percentiles(symbols)

        # Score each symbol
        scored: list[tuple[SymbolData, float, float, list[HighlightChip]]] = []

        for sym_data in symbols:
            # Compute bullish score
            bullish = self.bullish_scorer.score(sym_data.indicators)

            # Compute confidence with volume percentile
            confidence = self.confidence_scorer.score(
                sym_data.indicators,
                symbol_volume=sym_data.quote_volume_24h,
                volume_percentile=volume_percentiles.get(sym_data.symbol),
            )

            # Generate highlights
            highlights = generate_highlights(sym_data.indicators, max_chips=4)

            scored.append((sym_data, bullish, confidence, highlights))

        # Sort by bullish_score DESC, confidence DESC (tiebreaker)
        scored.sort(key=lambda x: (-x[1], -x[2]))

        # Generate ranked snapshots
        snapshots: list[RankedSnapshot] = []

        for rank, (sym_data, bullish, confidence, highlights) in enumerate(scored, 1):
            signals = self._extract_indicator_signals(sym_data.indicators)
            signals["_market"] = {
                "price_change_pct": self._sanitize_for_json(sym_data.price_change_pct),
                "volume_change_pct": self._sanitize_for_json(sym_data.volume_change_pct),
                "price_change_abs": self._sanitize_for_json(sym_data.price_change_abs),
                "volume_change_abs": self._sanitize_for_json(sym_data.volume_change_abs),
                "funding_rate": self._sanitize_for_json(sym_data.funding_rate),
            }
            snapshot = RankedSnapshot(
                symbol_id=sym_data.symbol_id,
                symbol=sym_data.symbol,
                timeframe=timeframe,
                bullish_score=Decimal(str(round(bullish, 3))),
                confidence=int(round(confidence * 100)),  # Convert to 0-100
                rank=rank,
                highlights=chips_to_list(highlights),
                indicator_signals=signals,
                computed_at=computed_at,
            )
            snapshots.append(snapshot)

        return snapshots

    def rank_single(
        self,
        sym_data: SymbolData,
        timeframe: str,
        volume_percentile: float | None = None,
        computed_at: datetime | None = None,
    ) -> tuple[float, float, list[HighlightChip]]:
        """Score a single symbol without ranking context.

        Useful for testing or when ranking context isn't available.

        Args:
            sym_data: Symbol data with indicators.
            timeframe: Timeframe (for reference).
            volume_percentile: Optional pre-computed volume percentile.
            computed_at: Optional timestamp.

        Returns:
            Tuple of (bullish_score, confidence, highlights).
        """
        bullish = self.bullish_scorer.score(sym_data.indicators)
        confidence = self.confidence_scorer.score(
            sym_data.indicators,
            symbol_volume=sym_data.quote_volume_24h,
            volume_percentile=volume_percentile,
        )
        highlights = generate_highlights(sym_data.indicators, max_chips=4)

        return bullish, confidence, highlights


# Default ranker instance
default_ranker = Ranker()
