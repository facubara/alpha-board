"""Rule-based Market Regime Detection strategy.

Mirrors the LLM cross-regime prompt from 003_seed_data.py.
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

        cf = context.cross_timeframe_confluence
        if not cf:
            return self._hold(0.0)

        tf_scores = cf.get("symbol_tf_scores", {})
        if not tf_scores:
            return self._hold(0.0)

        # 3. Detect current regime across all symbols
        # Count how many TFs are trending vs ranging for each symbol
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

            # Trending Bull regime: 4+ TFs bullish
            if bullish_trending >= 4 and avg_score > best_bull_score:
                best_bull_score = avg_score
                best_bull_symbol = symbol

            # Trending Bear regime: 4+ TFs bearish
            if bearish_trending >= 4 and avg_score < best_bear_score:
                best_bear_score = avg_score
                best_bear_symbol = symbol

        # Open long on strongest trending bull
        if best_bull_symbol:
            return TradeAction(
                action=ActionType.OPEN_LONG,
                symbol=best_bull_symbol,
                position_size_pct=0.15,
                stop_loss_pct=0.05,
                take_profit_pct=0.10,
                confidence=0.7,
            )

        # Open short on strongest trending bear
        if best_bear_symbol:
            return TradeAction(
                action=ActionType.OPEN_SHORT,
                symbol=best_bear_symbol,
                position_size_pct=0.15,
                stop_loss_pct=0.05,
                take_profit_pct=0.10,
                confidence=0.7,
            )

        # Ranging/transitioning: hold cash
        return self._hold(0.3)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit when regime shifts to ranging, or hard 5% stop per position."""
        cf = context.cross_timeframe_confluence
        tf_scores = cf.get("symbol_tf_scores", {}) if cf else {}

        for pos in context.portfolio.open_positions:
            # Hard risk limit: 5% loss
            if pos.pnl_pct is not None and pos.pnl_pct < -5.0:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.95)

            scores = tf_scores.get(pos.symbol)
            if not scores:
                continue

            tfs = list(scores.values())
            if len(tfs) < 4:
                continue

            # Check if regime shifted to ranging (most ADX < 20 proxy: scores near 0.5)
            neutral_count = sum(1 for s in tfs if 0.40 <= s <= 0.60)
            if neutral_count >= 4:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.8)

        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        if action.action == ActionType.HOLD:
            return "CrossRegime: market in ranging/transitioning regime. Holding cash."
        if action.action == ActionType.CLOSE:
            return f"CrossRegime: closing {action.symbol} — regime shift to ranging or hard stop hit."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return f"CrossRegime: opening {direction} {action.symbol} — trending regime detected across 4+ TFs."
