"""Rule-based Swing Trading strategy.

Mirrors the LLM swing prompt from 003_seed_data.py.
"""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class SwingStrategy(BaseRuleStrategy):
    """Capture multi-candle swings in trending markets."""

    MAX_CONCURRENT = 3

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exits first
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open? Swing uses max 3 concurrent
        if not self._can_open(context, max_positions=self.MAX_CONCURRENT):
            return self._hold(0.1)

        # 3. Scan rankings
        for r in context.primary_timeframe_rankings:
            if self._has_position(context, r.symbol):
                continue

            rsi = self._raw(r, "rsi_14", "value")
            adx = self._raw(r, "adx_14", "adx")
            pve50 = self._raw(r, "ema_50", "price_vs_ema_pct")
            pve200 = self._raw(r, "ema_200", "price_vs_ema_pct")
            ema50_val = self._raw(r, "ema_50", "ema")
            ema200_val = self._raw(r, "ema_200", "ema")
            stoch_k = self._raw(r, "stoch_14_3_3", "k")
            stoch_d = self._raw(r, "stoch_14_3_3", "d")

            if not all(v is not None for v in [rsi, adx, pve50, pve200, ema50_val, ema200_val, stoch_k, stoch_d]):
                continue

            # Skip ranging markets
            if adx < 20:
                continue

            # ── Long swing entry ─────────────────────────────────
            if (
                pve50 > 0
                and pve200 > 0
                and ema50_val > ema200_val  # EMA alignment
                and r.bullish_score >= 0.55
                and r.confidence >= 65
                and 40 <= rsi <= 55  # pulled back
                and stoch_k < 50
                and stoch_k > stoch_d  # turning up
            ):
                size = 0.20 if r.confidence >= 70 else 0.12
                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.04,
                    take_profit_pct=0.08,
                    confidence=r.bullish_score,
                )

            # ── Short swing entry ────────────────────────────────
            if (
                pve50 < 0
                and pve200 < 0
                and ema50_val < ema200_val
                and r.bullish_score <= 0.45
                and r.confidence >= 65
                and 45 <= rsi <= 60  # rallied from oversold
                and stoch_k > 50
                and stoch_k < stoch_d  # turning down
            ):
                size = 0.20 if r.confidence >= 70 else 0.12
                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.04,
                    take_profit_pct=0.08,
                    confidence=1.0 - r.bullish_score,
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit on RSI extreme or trend break (price vs EMA200)."""
        for pos in context.portfolio.open_positions:
            r = next((x for x in context.primary_timeframe_rankings if x.symbol == pos.symbol), None)
            if not r:
                continue

            rsi = self._raw(r, "rsi_14", "value")
            pve200 = self._raw(r, "ema_200", "price_vs_ema_pct")
            if rsi is None or pve200 is None:
                continue

            if pos.direction.value == "long" and (rsi >= 70 or pve200 < 0):
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.8)
            if pos.direction.value == "short" and (rsi <= 30 or pve200 > 0):
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.8)
        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        if action.action == ActionType.HOLD:
            return "Swing: no pullback entry in trending market detected. Holding."
        if action.action == ActionType.CLOSE:
            return f"Swing: closing {action.symbol} — RSI extreme or trend break detected."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return (
            f"Swing: opening {direction} {action.symbol} — "
            f"pullback in trending market, size={action.position_size_pct}."
        )
