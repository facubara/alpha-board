"""Rule-based Multi-TF Divergence strategy.

Mirrors the LLM cross-divergence prompt from 003_seed_data.py.
Enhanced to skip unreliable divergence signals in mixed regimes.
"""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class CrossDivergenceStrategy(BaseRuleStrategy):
    """Trade short/long-term signal disagreement — long-term trend wins."""

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exits
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open?
        if not self._can_open(context):
            return self._hold(0.1)

        # Skip divergence trades when higher TF trend is mixed (unreliable signal)
        regime = context.cross_timeframe_regime
        if regime and regime.higher_tf_trend == "mixed" and regime.higher_tf_confidence >= 60:
            return self._hold(0.2)

        cf = context.cross_timeframe_confluence
        if not cf:
            return self._hold(0.0)

        tf_scores = cf.get("symbol_tf_scores", {})
        if not tf_scores:
            return self._hold(0.0)

        # 3. Scan for divergence setups
        for symbol, scores in tf_scores.items():
            if self._has_position(context, symbol):
                continue

            lt_scores = [scores.get(tf) for tf in ("1d", "1w") if tf in scores]
            st_scores = [scores.get(tf) for tf in ("15m", "1h") if tf in scores]

            if not lt_scores or not st_scores:
                continue

            lt_avg = sum(lt_scores) / len(lt_scores)
            st_avg = sum(st_scores) / len(st_scores)

            # Long: long-term bullish + short-term bearish
            if lt_avg >= 0.60 and st_avg <= 0.35:
                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=symbol,
                    position_size_pct=0.10,
                    stop_loss_pct=0.05,
                    take_profit_pct=0.08,
                    confidence=0.6,
                )

            # Short: long-term bearish + short-term bullish
            if lt_avg <= 0.40 and st_avg >= 0.65:
                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=symbol,
                    position_size_pct=0.10,
                    stop_loss_pct=0.05,
                    take_profit_pct=0.08,
                    confidence=0.6,
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit when divergence resolves (short-term aligns with long-term)."""
        cf = context.cross_timeframe_confluence
        if not cf:
            return None

        tf_scores = cf.get("symbol_tf_scores", {})
        for pos in context.portfolio.open_positions:
            scores = tf_scores.get(pos.symbol)
            if not scores:
                continue

            lt_scores = [scores.get(tf) for tf in ("1d", "1w") if tf in scores]
            st_scores = [scores.get(tf) for tf in ("15m", "1h") if tf in scores]
            if not lt_scores or not st_scores:
                continue

            lt_avg = sum(lt_scores) / len(lt_scores)
            st_avg = sum(st_scores) / len(st_scores)

            # Long exit: divergence resolved (short-term now also bullish)
            if pos.direction.value == "long" and st_avg >= 0.55:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
            # Short exit: divergence resolved
            if pos.direction.value == "short" and st_avg <= 0.45:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
            # Emergency: long-term turned against us
            if pos.direction.value == "long" and lt_avg < 0.50:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.9)
            if pos.direction.value == "short" and lt_avg > 0.50:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.9)
        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        regime = context.cross_timeframe_regime
        regime_info = ""
        if regime and regime.higher_tf_trend:
            regime_info = f" [regime={regime.higher_tf_trend}]"

        if action.action == ActionType.HOLD:
            return f"CrossDivergence: no long/short-term divergence detected{regime_info}. Holding."
        if action.action == ActionType.CLOSE:
            return f"CrossDivergence: closing {action.symbol} — divergence resolved or long-term turned against{regime_info}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return f"CrossDivergence: opening {direction} {action.symbol} — LT/ST timeframe divergence detected{regime_info}."
