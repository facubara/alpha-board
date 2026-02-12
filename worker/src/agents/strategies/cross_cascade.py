"""Rule-based Timeframe Cascade strategy.

Mirrors the LLM cross-cascade prompt from 003_seed_data.py.
Enhanced to use regime labels to confirm cascade setups.
"""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class CrossCascadeStrategy(BaseRuleStrategy):
    """Trade signals cascading from longer to shorter timeframes."""

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

        tf_scores = cf.get("symbol_tf_scores", {})
        if not tf_scores:
            return self._hold(0.0)

        # Check regime for cascade confirmation
        regime = context.cross_timeframe_regime
        regime_1w = regime.regimes.get("1w") if regime else None
        regime_1d = regime.regimes.get("1d") if regime else None

        # 3. Scan for cascade setups
        for symbol, scores in tf_scores.items():
            if self._has_position(context, symbol):
                continue

            w_score = scores.get("1w")
            d_score = scores.get("1d")
            h4_score = scores.get("4h")
            h1_score = scores.get("1h")

            if w_score is None or d_score is None:
                continue

            # Need at least one shorter TF score
            shorter = h4_score if h4_score is not None else h1_score
            if shorter is None:
                continue

            # ── Long cascade: 1W bullish, 1D confirming, shorter not yet
            if w_score >= 0.60 and d_score >= 0.55 and shorter <= 0.50:
                # Enhanced: confirm with regime labels if available
                confidence = 0.65
                if regime_1w and regime_1d:
                    if "bull" in regime_1w.regime and "bull" in regime_1d.regime:
                        confidence = 0.80  # Strong cascade confirmation
                    elif "bear" in regime_1w.regime or "bear" in regime_1d.regime:
                        continue  # Regime contradicts cascade, skip

                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=symbol,
                    position_size_pct=0.12,
                    stop_loss_pct=0.06,
                    take_profit_pct=0.10,
                    confidence=confidence,
                )

            # ── Short cascade: 1W bearish, 1D confirming, shorter not yet
            if w_score <= 0.40 and d_score <= 0.45 and shorter >= 0.50:
                # Enhanced: confirm with regime labels if available
                confidence = 0.65
                if regime_1w and regime_1d:
                    if "bear" in regime_1w.regime and "bear" in regime_1d.regime:
                        confidence = 0.80  # Strong cascade confirmation
                    elif "bull" in regime_1w.regime or "bull" in regime_1d.regime:
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
        """Exit when cascade completes or 1W reverts."""
        cf = context.cross_timeframe_confluence
        if not cf:
            return None

        tf_scores = cf.get("symbol_tf_scores", {})
        for pos in context.portfolio.open_positions:
            scores = tf_scores.get(pos.symbol)
            if not scores:
                continue

            w_score = scores.get("1w")
            h1_score = scores.get("1h")

            # 1W reverted
            if pos.direction.value == "long" and w_score is not None and w_score < 0.50:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.85)
            if pos.direction.value == "short" and w_score is not None and w_score > 0.50:
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
            r1w = regime.regimes.get("1w")
            r1d = regime.regimes.get("1d")
            if r1w and r1d:
                regime_info = f" [1W={r1w.regime}, 1D={r1d.regime}]"

        if action.action == ActionType.HOLD:
            return f"CrossCascade: no timeframe cascade pattern detected{regime_info}. Holding."
        if action.action == ActionType.CLOSE:
            return f"CrossCascade: closing {action.symbol} — cascade completed or 1W reverted{regime_info}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return f"CrossCascade: opening {direction} {action.symbol} — 1W/1D aligned, shorter TFs lagging{regime_info}."
