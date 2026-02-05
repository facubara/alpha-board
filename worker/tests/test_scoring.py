"""Unit tests for the scoring module."""

from datetime import datetime, timezone
from decimal import Decimal

import numpy as np
import pytest

from src.scoring import (
    BullishScorer,
    ConfidenceScorer,
    Ranker,
    RankedSnapshot,
    SymbolData,
)


# =============================================================================
# Test Fixtures
# =============================================================================


def make_indicator_output(
    name: str,
    signal: float,
    weight: float = 0.1,
    label: str = "neutral",
    strength: str = "moderate",
    category: str = "momentum",
) -> dict:
    """Create a mock IndicatorOutput."""
    return {
        "name": name,
        "display_name": name.upper(),
        "category": category,
        "weight": weight,
        "raw": {"value": signal * 50 + 50},  # Mock raw value
        "signal": {
            "signal": signal,
            "label": label,
            "strength": strength,
        },
    }


@pytest.fixture
def all_bullish_indicators() -> dict:
    """Create indicators with all bullish signals."""
    return {
        "rsi_14": make_indicator_output("rsi_14", 0.8, 0.12, "bullish", "strong"),
        "macd": make_indicator_output("macd", 0.7, 0.15, "bullish", "strong"),
        "stoch": make_indicator_output("stoch", 0.6, 0.10, "bullish", "moderate"),
        "adx": make_indicator_output("adx", 0.5, 0.13, "bullish", "moderate", "trend"),
        "obv": make_indicator_output("obv", 0.4, 0.12, "bullish", "moderate", "volume"),
        "bbands": make_indicator_output("bbands", 0.3, 0.10, "bullish", "weak", "volatility"),
        "ema_20": make_indicator_output("ema_20", 0.5, 0.08, "bullish", "moderate", "trend"),
        "ema_50": make_indicator_output("ema_50", 0.4, 0.10, "bullish", "moderate", "trend"),
        "ema_200": make_indicator_output("ema_200", 0.3, 0.10, "bullish", "weak", "trend"),
    }


@pytest.fixture
def all_bearish_indicators() -> dict:
    """Create indicators with all bearish signals."""
    return {
        "rsi_14": make_indicator_output("rsi_14", -0.8, 0.12, "bearish", "strong"),
        "macd": make_indicator_output("macd", -0.7, 0.15, "bearish", "strong"),
        "stoch": make_indicator_output("stoch", -0.6, 0.10, "bearish", "moderate"),
        "adx": make_indicator_output("adx", -0.5, 0.13, "bearish", "moderate", "trend"),
        "obv": make_indicator_output("obv", -0.4, 0.12, "bearish", "moderate", "volume"),
        "bbands": make_indicator_output("bbands", -0.3, 0.10, "bearish", "weak", "volatility"),
        "ema_20": make_indicator_output("ema_20", -0.5, 0.08, "bearish", "moderate", "trend"),
        "ema_50": make_indicator_output("ema_50", -0.4, 0.10, "bearish", "moderate", "trend"),
        "ema_200": make_indicator_output("ema_200", -0.3, 0.10, "bearish", "weak", "trend"),
    }


@pytest.fixture
def mixed_indicators() -> dict:
    """Create indicators with mixed signals."""
    return {
        "rsi_14": make_indicator_output("rsi_14", 0.5, 0.12, "bullish", "moderate"),
        "macd": make_indicator_output("macd", -0.3, 0.15, "bearish", "weak"),
        "stoch": make_indicator_output("stoch", 0.2, 0.10, "bullish", "weak"),
        "adx": make_indicator_output("adx", -0.1, 0.13, "neutral", "weak", "trend"),
        "obv": make_indicator_output("obv", 0.4, 0.12, "bullish", "moderate", "volume"),
        "bbands": make_indicator_output("bbands", -0.2, 0.10, "bearish", "weak", "volatility"),
        "ema_20": make_indicator_output("ema_20", 0.1, 0.08, "neutral", "weak", "trend"),
        "ema_50": make_indicator_output("ema_50", -0.1, 0.10, "neutral", "weak", "trend"),
        "ema_200": make_indicator_output("ema_200", 0.0, 0.10, "neutral", "weak", "trend"),
    }


@pytest.fixture
def partial_indicators() -> dict:
    """Create indicators with some missing (NaN) signals."""
    return {
        "rsi_14": make_indicator_output("rsi_14", 0.5, 0.12, "bullish", "moderate"),
        "macd": make_indicator_output("macd", np.nan, 0.15, "neutral", "weak"),
        "stoch": make_indicator_output("stoch", 0.3, 0.10, "bullish", "weak"),
        "adx": make_indicator_output("adx", np.nan, 0.13, "neutral", "weak", "trend"),
        "obv": make_indicator_output("obv", 0.2, 0.12, "bullish", "weak", "volume"),
    }


# =============================================================================
# BullishScorer Tests
# =============================================================================


class TestBullishScorer:
    """Tests for BullishScorer."""

    def test_all_bullish_gives_high_score(self, all_bullish_indicators):
        """All bullish signals should give score > 0.7."""
        scorer = BullishScorer()
        score = scorer.score(all_bullish_indicators)
        assert score > 0.7
        assert score <= 1.0

    def test_all_bearish_gives_low_score(self, all_bearish_indicators):
        """All bearish signals should give score < 0.3."""
        scorer = BullishScorer()
        score = scorer.score(all_bearish_indicators)
        assert score < 0.3
        assert score >= 0.0

    def test_mixed_gives_middle_score(self, mixed_indicators):
        """Mixed signals should give score around 0.5."""
        scorer = BullishScorer()
        score = scorer.score(mixed_indicators)
        assert 0.3 <= score <= 0.7

    def test_empty_indicators_returns_neutral(self):
        """Empty indicators should return 0.5."""
        scorer = BullishScorer()
        score = scorer.score({})
        assert score == 0.5

    def test_handles_nan_signals(self, partial_indicators):
        """NaN signals should be ignored in scoring."""
        scorer = BullishScorer()
        score = scorer.score(partial_indicators)
        assert 0.0 <= score <= 1.0
        assert not np.isnan(score)

    def test_all_nan_returns_neutral(self):
        """All NaN signals should return 0.5."""
        indicators = {
            "ind1": make_indicator_output("ind1", np.nan, 0.5),
            "ind2": make_indicator_output("ind2", np.nan, 0.5),
        }
        scorer = BullishScorer()
        score = scorer.score(indicators)
        assert score == 0.5

    def test_score_range(self, all_bullish_indicators, all_bearish_indicators):
        """Score should always be in [0, 1]."""
        scorer = BullishScorer()

        for indicators in [all_bullish_indicators, all_bearish_indicators]:
            score = scorer.score(indicators)
            assert 0.0 <= score <= 1.0

    def test_score_with_details(self, mixed_indicators):
        """score_with_details should return breakdown."""
        scorer = BullishScorer()
        result = scorer.score_with_details(mixed_indicators)

        assert "bullish_score" in result
        assert "weighted_avg" in result
        assert "valid_indicators" in result
        assert "signal_breakdown" in result
        assert result["valid_indicators"] == 9
        assert len(result["signal_breakdown"]) == 9


# =============================================================================
# ConfidenceScorer Tests
# =============================================================================


class TestConfidenceScorer:
    """Tests for ConfidenceScorer."""

    def test_high_agreement_high_confidence(self, all_bullish_indicators):
        """High signal agreement should give high confidence."""
        scorer = ConfidenceScorer()
        agreement = scorer.compute_agreement(all_bullish_indicators)
        # All bullish = low std = high agreement
        assert agreement > 0.7

    def test_low_agreement_low_confidence(self):
        """Mixed signals should give lower agreement."""
        indicators = {
            "ind1": make_indicator_output("ind1", 1.0, 0.25),  # Max bullish
            "ind2": make_indicator_output("ind2", -1.0, 0.25),  # Max bearish
            "ind3": make_indicator_output("ind3", 1.0, 0.25),
            "ind4": make_indicator_output("ind4", -1.0, 0.25),
        }
        scorer = ConfidenceScorer()
        agreement = scorer.compute_agreement(indicators)
        assert agreement < 0.5

    def test_completeness_full(self, all_bullish_indicators):
        """Full data should give completeness = 1.0."""
        scorer = ConfidenceScorer(expected_indicators=9)
        completeness = scorer.compute_completeness(all_bullish_indicators)
        assert completeness == 1.0

    def test_completeness_partial(self, partial_indicators):
        """Partial data should give lower completeness."""
        scorer = ConfidenceScorer(expected_indicators=9)
        completeness = scorer.compute_completeness(partial_indicators)
        # 3 valid out of 5 total, expected 9
        assert completeness == 3 / 9

    def test_volume_high_percentile(self):
        """High volume should give high volume score."""
        scorer = ConfidenceScorer()
        score = scorer.compute_volume_adequacy(1000000, volume_percentile=0.9)
        assert score == 1.0

    def test_volume_low_percentile(self):
        """Low volume should give low volume score."""
        scorer = ConfidenceScorer()
        score = scorer.compute_volume_adequacy(100, volume_percentile=0.2)
        assert score < 0.5

    def test_overall_confidence_range(self, all_bullish_indicators):
        """Overall confidence should be in [0, 1]."""
        scorer = ConfidenceScorer()
        confidence = scorer.score(
            all_bullish_indicators,
            volume_percentile=0.5,
        )
        assert 0.0 <= confidence <= 1.0

    def test_score_with_details(self, mixed_indicators):
        """score_with_details should return component breakdown."""
        scorer = ConfidenceScorer()
        result = scorer.score_with_details(mixed_indicators, volume_percentile=0.5)

        assert "confidence" in result
        assert "components" in result
        assert "agreement" in result["components"]
        assert "completeness" in result["components"]
        assert "volume" in result["components"]


# =============================================================================
# Ranker Tests
# =============================================================================


class TestRanker:
    """Tests for Ranker."""

    def test_rank_orders_by_bullish_score(self):
        """Symbols should be ranked by bullish_score descending."""
        # Create symbols with different bullish levels
        sym1 = SymbolData(
            symbol="LOWSCORE",
            symbol_id=1,
            indicators={
                "ind1": make_indicator_output("ind1", -0.5, 0.5, "bearish"),
                "ind2": make_indicator_output("ind2", -0.3, 0.5, "bearish"),
            },
            quote_volume_24h=1000000,
        )
        sym2 = SymbolData(
            symbol="HIGHSCORE",
            symbol_id=2,
            indicators={
                "ind1": make_indicator_output("ind1", 0.8, 0.5, "bullish"),
                "ind2": make_indicator_output("ind2", 0.6, 0.5, "bullish"),
            },
            quote_volume_24h=2000000,
        )
        sym3 = SymbolData(
            symbol="MIDSCORE",
            symbol_id=3,
            indicators={
                "ind1": make_indicator_output("ind1", 0.2, 0.5, "bullish"),
                "ind2": make_indicator_output("ind2", 0.1, 0.5, "neutral"),
            },
            quote_volume_24h=1500000,
        )

        ranker = Ranker()
        snapshots = ranker.rank([sym1, sym2, sym3], timeframe="1h")

        assert len(snapshots) == 3
        assert snapshots[0].symbol == "HIGHSCORE"
        assert snapshots[0].rank == 1
        assert snapshots[1].symbol == "MIDSCORE"
        assert snapshots[1].rank == 2
        assert snapshots[2].symbol == "LOWSCORE"
        assert snapshots[2].rank == 3

    def test_snapshot_has_required_fields(self, all_bullish_indicators):
        """RankedSnapshot should have all required fields."""
        sym = SymbolData(
            symbol="BTCUSDT",
            symbol_id=1,
            indicators=all_bullish_indicators,
            quote_volume_24h=5000000000,
        )

        ranker = Ranker()
        snapshots = ranker.rank([sym], timeframe="1h")

        assert len(snapshots) == 1
        snap = snapshots[0]

        assert snap.symbol_id == 1
        assert snap.symbol == "BTCUSDT"
        assert snap.timeframe == "1h"
        assert isinstance(snap.bullish_score, Decimal)
        assert 0 <= float(snap.bullish_score) <= 1
        assert isinstance(snap.confidence, int)
        assert 0 <= snap.confidence <= 100
        assert snap.rank == 1
        assert isinstance(snap.highlights, list)
        assert isinstance(snap.indicator_signals, dict)
        assert isinstance(snap.computed_at, datetime)

    def test_empty_symbols_returns_empty(self):
        """Empty symbol list should return empty result."""
        ranker = Ranker()
        snapshots = ranker.rank([], timeframe="1h")
        assert snapshots == []

    def test_confidence_uses_volume_percentile(self):
        """Confidence should factor in volume percentile."""
        # Low volume symbol
        sym_low = SymbolData(
            symbol="LOWVOL",
            symbol_id=1,
            indicators={
                "ind1": make_indicator_output("ind1", 0.5, 1.0),
            },
            quote_volume_24h=100,
        )
        # High volume symbol
        sym_high = SymbolData(
            symbol="HIGHVOL",
            symbol_id=2,
            indicators={
                "ind1": make_indicator_output("ind1", 0.5, 1.0),
            },
            quote_volume_24h=10000000,
        )

        ranker = Ranker()
        snapshots = ranker.rank([sym_low, sym_high], timeframe="1h")

        # Find each snapshot
        low_snap = next(s for s in snapshots if s.symbol == "LOWVOL")
        high_snap = next(s for s in snapshots if s.symbol == "HIGHVOL")

        # High volume should have higher confidence
        assert high_snap.confidence > low_snap.confidence

    def test_indicator_signals_stored(self, all_bullish_indicators):
        """Indicator signals should be stored in snapshot."""
        sym = SymbolData(
            symbol="BTCUSDT",
            symbol_id=1,
            indicators=all_bullish_indicators,
        )

        ranker = Ranker()
        snapshots = ranker.rank([sym], timeframe="1h")

        signals = snapshots[0].indicator_signals
        assert "rsi_14" in signals
        assert "signal" in signals["rsi_14"]
        assert "weight" in signals["rsi_14"]
        assert "raw" in signals["rsi_14"]

    def test_tiebreaker_uses_confidence(self):
        """Same bullish score should be broken by confidence."""
        # Same signals but different volumes
        indicators = {
            "ind1": make_indicator_output("ind1", 0.5, 1.0),
        }

        sym1 = SymbolData(
            symbol="LOWCONF",
            symbol_id=1,
            indicators=indicators.copy(),
            quote_volume_24h=100,  # Low volume = low confidence
        )
        sym2 = SymbolData(
            symbol="HIGHCONF",
            symbol_id=2,
            indicators=indicators.copy(),
            quote_volume_24h=10000000,  # High volume = high confidence
        )

        ranker = Ranker()
        snapshots = ranker.rank([sym1, sym2], timeframe="1h")

        # Same bullish score, but higher confidence should rank first
        assert snapshots[0].symbol == "HIGHCONF"
        assert snapshots[0].rank == 1


class TestRankerSingleSymbol:
    """Tests for single symbol scoring."""

    def test_rank_single(self, all_bullish_indicators):
        """rank_single should return scores without ranking context."""
        sym = SymbolData(
            symbol="BTCUSDT",
            symbol_id=1,
            indicators=all_bullish_indicators,
            quote_volume_24h=5000000000,
        )

        ranker = Ranker()
        bullish, confidence, highlights = ranker.rank_single(
            sym, timeframe="1h", volume_percentile=0.9
        )

        assert 0.0 <= bullish <= 1.0
        assert 0.0 <= confidence <= 1.0
        assert isinstance(highlights, list)
