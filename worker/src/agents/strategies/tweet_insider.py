"""Tweet-based Insider strategy — weight founder/insider accounts higher."""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class TweetInsiderStrategy(BaseRuleStrategy):
    """Weight founder/insider category signals 2x higher.

    Applies 2x weight to founder/insider category signals.
    Entry Long: weighted_sentiment >= 0.3, >= 1 insider long_entry signal.
    Entry Short: weighted_sentiment <= -0.3, >= 1 insider short_entry signal.
    Exit: insider sentiment flips.
    Sizing: 10%. SL 3%, TP 6%.
    """

    INSIDER_CATEGORIES = {"founder", "insider"}

    def evaluate(self, context: AgentContext) -> TradeAction:
        tc = context.tweet_context
        if not tc or not tc.signals:
            return self._hold(0.0)

        # Check exits first
        close = self._check_exits(context)
        if close:
            return close

        if not self._can_open(context):
            return self._hold(0.1)

        # Compute weighted sentiment (insiders get 2x weight)
        total_weight = 0.0
        weighted_sum = 0.0
        insider_long_symbols: list[str] = []
        insider_short_symbols: list[str] = []

        for sig in tc.signals:
            weight = 2.0 if sig.category in self.INSIDER_CATEGORIES else 1.0
            total_weight += weight
            weighted_sum += sig.sentiment_score * weight

            if sig.category in self.INSIDER_CATEGORIES:
                if sig.setup_type == "long_entry":
                    insider_long_symbols.extend(sig.symbols_mentioned)
                elif sig.setup_type == "short_entry":
                    insider_short_symbols.extend(sig.symbols_mentioned)

        weighted_sentiment = weighted_sum / total_weight if total_weight > 0 else 0.0

        # Long entry
        if weighted_sentiment >= 0.3 and insider_long_symbols:
            # Pick most mentioned insider symbol
            sym_counts: dict[str, int] = {}
            for sym in insider_long_symbols:
                sym_counts[sym] = sym_counts.get(sym, 0) + 1
            best_sym = max(sym_counts, key=sym_counts.get)  # type: ignore[arg-type]

            if not self._has_position(context, best_sym):
                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=best_sym,
                    position_size_pct=0.10,
                    stop_loss_pct=0.03,
                    take_profit_pct=0.06,
                    confidence=min(weighted_sentiment, 1.0),
                )

        # Short entry
        if weighted_sentiment <= -0.3 and insider_short_symbols:
            sym_counts = {}
            for sym in insider_short_symbols:
                sym_counts[sym] = sym_counts.get(sym, 0) + 1
            best_sym = max(sym_counts, key=sym_counts.get)  # type: ignore[arg-type]

            if not self._has_position(context, best_sym):
                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=best_sym,
                    position_size_pct=0.10,
                    stop_loss_pct=0.03,
                    take_profit_pct=0.06,
                    confidence=min(abs(weighted_sentiment), 1.0),
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        tc = context.tweet_context
        if not tc:
            return None

        # Compute insider-only sentiment
        insider_signals = [s for s in tc.signals if s.category in self.INSIDER_CATEGORIES]
        if not insider_signals:
            return None

        insider_sentiment = sum(s.sentiment_score for s in insider_signals) / len(insider_signals)

        for pos in context.portfolio.open_positions:
            # Exit when insider sentiment flips
            if pos.direction.value == "long" and insider_sentiment < -0.1:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
            if pos.direction.value == "short" and insider_sentiment > 0.1:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)

        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        tc = context.tweet_context
        insider_count = (
            len([s for s in tc.signals if s.category in self.INSIDER_CATEGORIES])
            if tc
            else 0
        )
        sentiment_str = f"avg_sentiment={tc.avg_sentiment:.2f}, insider_signals={insider_count}" if tc else "no tweet data"

        if action.action == ActionType.HOLD:
            return f"TweetInsider: no insider entry signals. {sentiment_str}. Holding."
        if action.action == ActionType.CLOSE:
            return f"TweetInsider: closing {action.symbol} — insider sentiment flipped. {sentiment_str}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return (
            f"TweetInsider: opening {direction} {action.symbol} — "
            f"insider-weighted signal detected. {sentiment_str}. "
            f"Size={action.position_size_pct}, SL={action.stop_loss_pct}, TP={action.take_profit_pct}."
        )
