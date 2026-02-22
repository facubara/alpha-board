"""Rule-based Momentum Trading strategy.

Mirrors the LLM momentum prompt from 003_seed_data.py.
"""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class MomentumStrategy(BaseRuleStrategy):
    """Follow the trend — strong moves tend to continue."""

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exit conditions for open positions
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open?
        if not self._can_open(context):
            return self._hold(0.1)

        # 3. Scan rankings for entry signals
        for r in context.primary_timeframe_rankings:
            if self._has_position(context, r.symbol):
                continue

            rsi = self._raw(r, "rsi_14", "value")
            macd_hist = self._raw(r, "macd_12_26_9", "histogram")
            adx = self._raw(r, "adx_14", "adx")
            plus_di = self._raw(r, "adx_14", "plus_di")
            minus_di = self._raw(r, "adx_14", "minus_di")
            obv_slope = self._raw(r, "obv", "slope_normalized")
            pve50 = self._raw(r, "ema_50", "price_vs_ema_pct")
            pve200 = self._raw(r, "ema_200", "price_vs_ema_pct")

            if not all(v is not None for v in [rsi, macd_hist, adx, plus_di, minus_di, obv_slope, pve50, pve200]):
                continue

            # ── Long entry ───────────────────────────────────────
            if (
                r.bullish_score >= 0.70
                and r.confidence >= 60
                and 50 <= rsi <= 70
                and macd_hist > 0
                and adx > 25
                and plus_di > minus_di
                and pve50 > 0
                and pve200 > 0
                and obv_slope > 0
                and self._regime_allows_direction(context, "long")
            ):
                size = 0.15 if r.confidence >= 75 else 0.08
                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.04,
                    take_profit_pct=0.06,
                    confidence=r.bullish_score,
                )

            # ── Short entry ──────────────────────────────────────
            if (
                r.bullish_score <= 0.30
                and r.confidence >= 60
                and 30 <= rsi <= 50
                and macd_hist < 0
                and adx > 25
                and minus_di > plus_di
                and pve50 < 0
                and pve200 < 0
                and self._regime_allows_direction(context, "short")
            ):
                size = 0.15 if r.confidence >= 75 else 0.08
                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.04,
                    take_profit_pct=0.06,
                    confidence=1.0 - r.bullish_score,
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit long: RSI > 75 or price < EMA20. Short inverse."""
        for pos in context.portfolio.open_positions:
            r = next((x for x in context.primary_timeframe_rankings if x.symbol == pos.symbol), None)
            if not r:
                continue

            rsi = self._raw(r, "rsi_14", "value")
            pve20 = self._raw(r, "ema_20", "price_vs_ema_pct")
            if rsi is None or pve20 is None:
                continue

            if pos.direction.value == "long" and (rsi > 75 or pve20 < 0):
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.8)
            if pos.direction.value == "short" and (rsi < 25 or pve20 > 0):
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.8)
        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        if action.action == ActionType.HOLD:
            return "Momentum: no entry/exit conditions met. Holding."
        if action.action == ActionType.CLOSE:
            return f"Momentum: closing {action.symbol} — exit signal triggered (RSI extreme or EMA20 cross)."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return (
            f"Momentum: opening {direction} {action.symbol} — "
            f"score conditions met, size={action.position_size_pct}, "
            f"SL={action.stop_loss_pct}, TP={action.take_profit_pct}, "
            f"confidence={action.confidence:.2f}."
        )
