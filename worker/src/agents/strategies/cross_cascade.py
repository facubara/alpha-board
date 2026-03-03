"""Rule-based Timeframe Cascade strategy.

Mirrors the LLM cross-cascade prompt from 003_seed_data.py.
Enhanced to use regime labels to confirm cascade setups.

Cascade: 1D → 4H → 1H (longest confirms, shorter TFs lag).
"""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class CrossCascadeStrategy(BaseRuleStrategy):
    """Trade signals cascading from longer to shorter timeframes."""

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exits
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open?
        if not self._can_open(context):
            return self._hold(0.1)

        cf = context.cross_timeframe_confluence
        if not cf:
            return self._hold(0.0)

        tf_scores = cf.get("symbol_tf_scores", {})
        if not tf_scores:
            return self._hold(0.0)

        # Check regime for cascade confirmation
        regime = context.cross_timeframe_regime
        regime_1d = regime.regimes.get("1d") if regime else None
        regime_4h = regime.regimes.get("4h") if regime else None

        # 3. Scan for cascade setups
        for symbol, scores in tf_scores.items():
            if self._has_position(context, symbol):
                continue

            d_score = scores.get("1d")
            h4_score = scores.get("4h")
            h1_score = scores.get("1h")

            if d_score is None or h4_score is None:
                continue

            # Need at least one shorter TF score
            shorter = h1_score
            if shorter is None:
                continue

            # ── Long cascade: 1D bullish, 4H confirming, 1H not yet
            if d_score >= 0.60 and h4_score >= 0.55 and shorter <= 0.50:
                # Enhanced: confirm with regime labels if available
                confidence = 0.65
                if regime_1d and regime_4h:
                    if "bull" in regime_1d.regime and "bull" in regime_4h.regime:
                        confidence = 0.80  # Strong cascade confirmation
                    elif "bear" in regime_1d.regime or "bear" in regime_4h.regime:
                        continue  # Regime contradicts cascade, skip

                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=symbol,
                    position_size_pct=0.12,
                    stop_loss_pct=0.06,
                    take_profit_pct=0.10,
                    confidence=confidence,
                )

            # ── Short cascade: 1D bearish, 4H confirming, 1H not yet
            if d_score <= 0.40 and h4_score <= 0.45 and shorter >= 0.50:
                # Enhanced: confirm with regime labels if available
                confidence = 0.65
                if regime_1d and regime_4h:
                    if "bear" in regime_1d.regime and "bear" in regime_4h.regime:
                        confidence = 0.80  # Strong cascade confirmation
                    elif "bull" in regime_1d.regime or "bull" in regime_4h.regime:
                        continue  # Regime contradicts cascade, skip

                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=symbol,
                    position_size_pct=0.12,
                    stop_loss_pct=0.06,
                    take_profit_pct=0.10,
                    confidence=confidence,
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit when cascade completes or 1D reverts."""
        cf = context.cross_timeframe_confluence
        if not cf:
            return None

        tf_scores = cf.get("symbol_tf_scores", {})
        for pos in context.portfolio.open_positions:
            scores = tf_scores.get(pos.symbol)
            if not scores:
                continue

            d_score = scores.get("1d")
            h1_score = scores.get("1h")

            # 1D reverted
            if pos.direction.value == "long" and d_score is not None and d_score < 0.50:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.85)
            if pos.direction.value == "short" and d_score is not None and d_score > 0.50:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.85)

            # Cascade completed (1H aligned)
            if pos.direction.value == "long" and h1_score is not None and h1_score >= 0.60:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
            if pos.direction.value == "short" and h1_score is not None and h1_score <= 0.40:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        regime = context.cross_timeframe_regime
        regime_info = ""
        if regime:
            r1d = regime.regimes.get("1d")
            r4h = regime.regimes.get("4h")
            if r1d and r4h:
                regime_info = f" [1D={r1d.regime}, 4H={r4h.regime}]"

        if action.action == ActionType.HOLD:
            return f"CrossCascade: no timeframe cascade pattern detected{regime_info}. Holding."
        if action.action == ActionType.CLOSE:
            return f"CrossCascade: closing {action.symbol} — cascade completed or 1D reverted{regime_info}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return f"CrossCascade: opening {direction} {action.symbol} — 1D/4H aligned, shorter TFs lagging{regime_info}."
