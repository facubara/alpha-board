"""Rule-based Breakout Trading strategy.

Mirrors the LLM breakout prompt from 003_seed_data.py.
"""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class BreakoutStrategy(BaseRuleStrategy):
    """Trade range breaks with volume confirmation."""

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exits (false breakout detection)
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open?
        if not self._can_open(context):
            return self._hold(0.1)

        # 3. Be very selective: skip if 2+ open positions already
        if context.portfolio.position_count >= 2:
            return self._hold(0.1)

        # 4. Scan for breakout setups
        for r in context.primary_timeframe_rankings:
            if self._has_position(context, r.symbol):
                continue

            bandwidth = self._raw(r, "bbands_20_2", "bandwidth")
            pct_b = self._raw(r, "bbands_20_2", "percent_b")
            obv_slope = self._raw(r, "obv", "slope_normalized")
            adx = self._raw(r, "adx_14", "adx")
            plus_di = self._raw(r, "adx_14", "plus_di")
            minus_di = self._raw(r, "adx_14", "minus_di")

            if not all(v is not None for v in [bandwidth, pct_b, obv_slope, adx]):
                continue

            # Squeeze condition: low bandwidth
            is_squeeze = bandwidth < 5

            # ── Long breakout ────────────────────────────────────
            if (
                is_squeeze
                and pct_b > 1.0  # price above upper BB
                and obv_slope > 2.0  # volume spike
                and adx < 25  # trend emerging, not mature
                and 0.55 <= r.bullish_score <= 0.75
                and self._regime_allows_direction(context, "long")
            ):
                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=r.symbol,
                    position_size_pct=0.08,
                    stop_loss_pct=0.05,
                    take_profit_pct=0.10,
                    confidence=0.65,
                )

            # ── Short breakout ───────────────────────────────────
            if (
                is_squeeze
                and pct_b < 0.0  # price below lower BB
                and obv_slope < -2.0  # volume spike down
                and adx < 25
                and plus_di is not None
                and minus_di is not None
                and minus_di > plus_di
                and self._regime_allows_direction(context, "short")
            ):
                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=r.symbol,
                    position_size_pct=0.08,
                    stop_loss_pct=0.05,
                    take_profit_pct=0.10,
                    confidence=0.65,
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit if price re-enters BB (false breakout)."""
        for pos in context.portfolio.open_positions:
            r = next((x for x in context.primary_timeframe_rankings if x.symbol == pos.symbol), None)
            if not r:
                continue

            pct_b = self._raw(r, "bbands_20_2", "percent_b")
            if pct_b is None:
                continue

            # False breakout: price returned inside bands
            if pos.direction.value == "long" and 0.0 <= pct_b <= 1.0:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.75)
            if pos.direction.value == "short" and 0.0 <= pct_b <= 1.0:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.75)
        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        if action.action == ActionType.HOLD:
            return "Breakout: no BB squeeze + breakout conditions detected. Holding."
        if action.action == ActionType.CLOSE:
            return f"Breakout: closing {action.symbol} — false breakout, price re-entered Bollinger Bands."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return f"Breakout: opening {direction} {action.symbol} — BB squeeze breakout with volume confirmation."
