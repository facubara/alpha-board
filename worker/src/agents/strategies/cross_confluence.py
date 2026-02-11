"""Rule-based Multi-TF Confluence strategy.

Mirrors the LLM cross-confluence prompt from 003_seed_data.py.
"""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class CrossConfluenceStrategy(BaseRuleStrategy):
    """Only trade when multiple timeframes agree."""

    MAX_CONCURRENT = 3

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exits
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open?
        if not self._can_open(context, max_positions=self.MAX_CONCURRENT):
            return self._hold(0.1)

        cf = context.cross_timeframe_confluence
        if not cf:
            return self._hold(0.0)

        # 3. Long: symbol in bullish confluence (3+ TFs with score > 0.6)
        for symbol in cf.get("bullish_confluence", []):
            if self._has_position(context, symbol):
                continue
            return TradeAction(
                action=ActionType.OPEN_LONG,
                symbol=symbol,
                position_size_pct=0.18,
                stop_loss_pct=0.06,
                take_profit_pct=0.12,
                confidence=0.8,
            )

        # 4. Short: symbol in bearish confluence
        for symbol in cf.get("bearish_confluence", []):
            if self._has_position(context, symbol):
                continue
            return TradeAction(
                action=ActionType.OPEN_SHORT,
                symbol=symbol,
                position_size_pct=0.18,
                stop_loss_pct=0.06,
                take_profit_pct=0.12,
                confidence=0.8,
            )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit when symbol drops out of confluence list."""
        cf = context.cross_timeframe_confluence
        if not cf:
            return None

        bullish_set = set(cf.get("bullish_confluence", []))
        bearish_set = set(cf.get("bearish_confluence", []))

        for pos in context.portfolio.open_positions:
            if pos.direction.value == "long" and pos.symbol not in bullish_set:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
            if pos.direction.value == "short" and pos.symbol not in bearish_set:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        if action.action == ActionType.HOLD:
            return "CrossConfluence: no multi-TF agreement found. Holding."
        if action.action == ActionType.CLOSE:
            return f"CrossConfluence: closing {action.symbol} — dropped from confluence list."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return f"CrossConfluence: opening {direction} {action.symbol} — 3+ timeframes aligned."
