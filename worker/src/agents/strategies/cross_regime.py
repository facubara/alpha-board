"""Rule-based Market Regime Detection strategy.

Mirrors the LLM cross-regime prompt from 003_seed_data.py.
Enhanced to use persisted regime labels from timeframe_regimes.
"""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class CrossRegimeStrategy(BaseRuleStrategy):
    """Identify market regime changes and position accordingly."""

    MAX_CONCURRENT = 3

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exits (regime shift or hard stop)
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open?
        if not self._can_open(context, max_positions=self.MAX_CONCURRENT):
            return self._hold(0.1)

        # Use persisted regime data if available
        regime = context.cross_timeframe_regime
        if regime and regime.higher_tf_trend:
            return self._evaluate_with_regime(context, regime)

        # Fallback: original confluence-based logic
        return self._evaluate_fallback(context)

    def _evaluate_with_regime(self, context: AgentContext, regime) -> TradeAction:
        """Use persisted higher_tf_trend for entry decisions."""
        trend = regime.higher_tf_trend
        confidence = regime.higher_tf_confidence

        # Only trade clear trending regimes with sufficient confidence
        if trend not in ("bull", "bear") or confidence < 60:
            return self._hold(0.3)

        cf = context.cross_timeframe_confluence
        if not cf:
            return self._hold(0.2)

        tf_scores = cf.get("symbol_tf_scores", {})
        if not tf_scores:
            return self._hold(0.2)

        # Scale confidence by regime confidence
        conf_scale = min(1.0, confidence / 80)

        if trend == "bull":
            # Find best symbol to go long
            for symbol, scores in tf_scores.items():
                if self._has_position(context, symbol):
                    continue
                tfs = list(scores.values())
                if len(tfs) < 4:
                    continue
                avg_score = sum(tfs) / len(tfs)
                bullish_count = sum(1 for s in tfs if s > 0.60)
                if bullish_count >= 3 and avg_score > 0.55:
                    return TradeAction(
                        action=ActionType.OPEN_LONG,
                        symbol=symbol,
                        position_size_pct=0.15,
                        stop_loss_pct=0.05,
                        take_profit_pct=0.10,
                        confidence=round(0.7 * conf_scale, 2),
                    )

        elif trend == "bear":
            # Find best symbol to go short
            for symbol, scores in tf_scores.items():
                if self._has_position(context, symbol):
                    continue
                tfs = list(scores.values())
                if len(tfs) < 4:
                    continue
                avg_score = sum(tfs) / len(tfs)
                bearish_count = sum(1 for s in tfs if s < 0.40)
                if bearish_count >= 3 and avg_score < 0.45:
                    return TradeAction(
                        action=ActionType.OPEN_SHORT,
                        symbol=symbol,
                        position_size_pct=0.15,
                        stop_loss_pct=0.05,
                        take_profit_pct=0.10,
                        confidence=round(0.7 * conf_scale, 2),
                    )

        return self._hold(0.3)

    def _evaluate_fallback(self, context: AgentContext) -> TradeAction:
        """Original logic: detect regime from confluence scores."""
        cf = context.cross_timeframe_confluence
        if not cf:
            return self._hold(0.0)

        tf_scores = cf.get("symbol_tf_scores", {})
        if not tf_scores:
            return self._hold(0.0)

        best_bull_symbol = None
        best_bull_score = 0.0
        best_bear_symbol = None
        best_bear_score = 1.0

        for symbol, scores in tf_scores.items():
            if self._has_position(context, symbol):
                continue
            tfs = list(scores.values())
            if len(tfs) < 4:
                continue
            bullish_trending = sum(1 for s in tfs if s > 0.60)
            bearish_trending = sum(1 for s in tfs if s < 0.40)
            avg_score = sum(tfs) / len(tfs)

            if bullish_trending >= 4 and avg_score > best_bull_score:
                best_bull_score = avg_score
                best_bull_symbol = symbol
            if bearish_trending >= 4 and avg_score < best_bear_score:
                best_bear_score = avg_score
                best_bear_symbol = symbol

        if best_bull_symbol:
            return TradeAction(
                action=ActionType.OPEN_LONG,
                symbol=best_bull_symbol,
                position_size_pct=0.15,
                stop_loss_pct=0.05,
                take_profit_pct=0.10,
                confidence=0.7,
            )
        if best_bear_symbol:
            return TradeAction(
                action=ActionType.OPEN_SHORT,
                symbol=best_bear_symbol,
                position_size_pct=0.15,
                stop_loss_pct=0.05,
                take_profit_pct=0.10,
                confidence=0.7,
            )
        return self._hold(0.3)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit when regime shifts to ranging, or hard 5% stop per position."""
        # Use persisted regime for exit check
        regime = context.cross_timeframe_regime
        for pos in context.portfolio.open_positions:
            # Hard risk limit: 5% loss
            if pos.pnl_pct is not None and pos.pnl_pct < -5.0:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.95)

            # Regime-based exit: higher TF shifted to ranging/mixed
            if regime and regime.higher_tf_trend in ("ranging", "mixed") and regime.higher_tf_confidence > 60:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.8)

        # Fallback: confluence-based exit
        cf = context.cross_timeframe_confluence
        tf_scores = cf.get("symbol_tf_scores", {}) if cf else {}
        for pos in context.portfolio.open_positions:
            scores = tf_scores.get(pos.symbol)
            if not scores:
                continue
            tfs = list(scores.values())
            if len(tfs) < 4:
                continue
            neutral_count = sum(1 for s in tfs if 0.40 <= s <= 0.60)
            if neutral_count >= 4:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.8)

        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        regime = context.cross_timeframe_regime
        regime_info = ""
        if regime and regime.higher_tf_trend:
            regime_info = f" (regime={regime.higher_tf_trend}, conf={regime.higher_tf_confidence:.0f}%)"

        if action.action == ActionType.HOLD:
            return f"CrossRegime: market in ranging/transitioning regime{regime_info}. Holding cash."
        if action.action == ActionType.CLOSE:
            return f"CrossRegime: closing {action.symbol} — regime shift or hard stop{regime_info}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return f"CrossRegime: opening {direction} {action.symbol} — trending regime detected{regime_info}."
