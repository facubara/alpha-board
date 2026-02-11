"""Base class for rule-based trading strategies."""

from abc import ABC, abstractmethod
from typing import Any

from src.agents.schemas import (
    ActionType,
    AgentContext,
    RankingContext,
    TradeAction,
)


class BaseRuleStrategy(ABC):
    """Base class for all rule-based trading strategies.

    Subclasses implement evaluate() with deterministic if/else logic
    that mirrors the LLM strategy prompts.
    """

    @abstractmethod
    def evaluate(self, context: AgentContext) -> TradeAction:
        """Evaluate the context and return a trade action."""
        ...

    @abstractmethod
    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        """Generate a human-readable reasoning string for the decision."""
        ...

    # ── Helpers ──────────────────────────────────────────────────────

    def _hold(self, confidence: float = 0.0) -> TradeAction:
        return TradeAction(action=ActionType.HOLD, confidence=confidence)

    def _get_indicator(
        self, ranking: RankingContext, name: str
    ) -> dict[str, Any] | None:
        """Find an indicator dict by name in ranking.indicator_signals."""
        for sig in ranking.indicator_signals:
            if isinstance(sig, dict) and sig.get("name") == name:
                return sig
        return None

    def _raw(
        self, ranking: RankingContext, indicator_name: str, field: str
    ) -> float | None:
        """Shortcut to get a raw indicator value."""
        ind = self._get_indicator(ranking, indicator_name)
        if ind and "rawValues" in ind:
            return ind["rawValues"].get(field)
        if ind and "raw" in ind:
            return ind["raw"].get(field)
        return None

    def _signal_val(self, ranking: RankingContext, indicator_name: str) -> float | None:
        """Get the normalized signal value [-1, +1] for an indicator."""
        ind = self._get_indicator(ranking, indicator_name)
        if ind:
            return ind.get("signal")
        return None

    def _has_position(self, context: AgentContext, symbol: str) -> bool:
        """Check if agent already holds a position in this symbol."""
        return any(p.symbol == symbol for p in context.portfolio.open_positions)

    def _can_open(self, context: AgentContext, max_positions: int = 5) -> bool:
        """Check if agent can open a new position."""
        return (
            context.portfolio.position_count < max_positions
            and context.portfolio.available_for_new_position > 0
        )
