"""Tweet-based Narrative strategy — follow macro thesis from credible sources."""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class TweetNarrativeStrategy(BaseRuleStrategy):
    """Follow macro thesis from analyst/founder accounts.

    Entry Long: >= 3 signals with setup_type "long_entry", from analyst/founder accounts.
    Entry Short: >= 3 signals with setup_type "short_entry", from analyst/founder accounts.
    Filters out "degen" category for higher signal quality.
    Exit: narrative shifts (setup_type changes to "warning" or "take_profit").
    Sizing: 15%. SL 4%, TP 10%.
    """

    CREDIBLE_CATEGORIES = {"analyst", "founder", "insider", "protocol"}

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

        # Filter to credible sources only (exclude degen)
        credible = [s for s in tc.signals if s.category in self.CREDIBLE_CATEGORIES]

        # Count long_entry signals by symbol
        long_signals: dict[str, int] = {}
        short_signals: dict[str, int] = {}
        for sig in credible:
            if sig.setup_type == "long_entry":
                for sym in sig.symbols_mentioned:
                    long_signals[sym] = long_signals.get(sym, 0) + 1
            elif sig.setup_type == "short_entry":
                for sym in sig.symbols_mentioned:
                    short_signals[sym] = short_signals.get(sym, 0) + 1

        # Long entry: >= 3 credible long_entry signals
        for sym, count in sorted(long_signals.items(), key=lambda x: -x[1]):
            if count >= 3 and not self._has_position(context, sym):
                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=sym,
                    position_size_pct=0.15,
                    stop_loss_pct=0.04,
                    take_profit_pct=0.10,
                    confidence=min(count / 5.0, 1.0),
                )

        # Short entry: >= 3 credible short_entry signals
        for sym, count in sorted(short_signals.items(), key=lambda x: -x[1]):
            if count >= 3 and not self._has_position(context, sym):
                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=sym,
                    position_size_pct=0.15,
                    stop_loss_pct=0.04,
                    take_profit_pct=0.10,
                    confidence=min(count / 5.0, 1.0),
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        tc = context.tweet_context
        if not tc:
            return None

        credible = [s for s in tc.signals if s.category in self.CREDIBLE_CATEGORIES]

        for pos in context.portfolio.open_positions:
            # Exit if narrative shifts to warning or take_profit
            warning_count = sum(
                1 for s in credible
                if s.setup_type in ("warning", "take_profit")
                and pos.symbol in [sym + "USDT" for sym in s.symbols_mentioned] + s.symbols_mentioned
            )
            if warning_count >= 2:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)

        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        tc = context.tweet_context
        credible_count = (
            len([s for s in tc.signals if s.category in self.CREDIBLE_CATEGORIES])
            if tc
            else 0
        )
        sentiment_str = f"avg_sentiment={tc.avg_sentiment:.2f}, credible_signals={credible_count}" if tc else "no tweet data"

        if action.action == ActionType.HOLD:
            return f"TweetNarrative: insufficient credible narrative signals. {sentiment_str}. Holding."
        if action.action == ActionType.CLOSE:
            return f"TweetNarrative: closing {action.symbol} — narrative shifted to warning/take_profit. {sentiment_str}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return (
            f"TweetNarrative: opening {direction} {action.symbol} — "
            f"credible analyst/founder consensus. {sentiment_str}. "
            f"Size={action.position_size_pct}, SL={action.stop_loss_pct}, TP={action.take_profit_pct}."
        )
