"""Tweet-based Contrarian strategy — fade overreaction."""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class TweetContrarianStrategy(BaseRuleStrategy):
    """Fade extreme crowd sentiment — buy panic, sell euphoria.

    Entry Long: avg_sentiment <= -0.6 (extreme fear), >= 4 bearish signals.
    Entry Short: avg_sentiment >= 0.6 (extreme greed), >= 4 bullish signals.
    Exit: sentiment returns to neutral range (-0.2 to +0.2).
    Sizing: 10%. SL 5%, TP 6%.
    """

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

        # Contrarian long: extreme fear = buy opportunity
        if tc.avg_sentiment <= -0.6 and tc.bearish_count >= 4:
            for sym in tc.most_mentioned_symbols:
                if not self._has_position(context, sym):
                    return TradeAction(
                        action=ActionType.OPEN_LONG,
                        symbol=sym,
                        position_size_pct=0.10,
                        stop_loss_pct=0.05,
                        take_profit_pct=0.06,
                        confidence=min(abs(tc.avg_sentiment), 1.0),
                    )

        # Contrarian short: extreme greed = sell opportunity
        if tc.avg_sentiment >= 0.6 and tc.bullish_count >= 4:
            for sym in tc.most_mentioned_symbols:
                if not self._has_position(context, sym):
                    return TradeAction(
                        action=ActionType.OPEN_SHORT,
                        symbol=sym,
                        position_size_pct=0.10,
                        stop_loss_pct=0.05,
                        take_profit_pct=0.06,
                        confidence=min(tc.avg_sentiment, 1.0),
                    )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        tc = context.tweet_context
        if not tc:
            return None

        # Exit when sentiment returns to neutral
        if -0.2 <= tc.avg_sentiment <= 0.2:
            for pos in context.portfolio.open_positions:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)

        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        tc = context.tweet_context
        sentiment_str = f"avg_sentiment={tc.avg_sentiment:.2f}" if tc else "no tweet data"

        if action.action == ActionType.HOLD:
            return f"TweetContrarian: no extreme sentiment detected. {sentiment_str}. Holding."
        if action.action == ActionType.CLOSE:
            return f"TweetContrarian: closing {action.symbol} — sentiment normalized to neutral. {sentiment_str}."
        direction = "LONG (fading fear)" if action.action == ActionType.OPEN_LONG else "SHORT (fading greed)"
        return (
            f"TweetContrarian: opening {direction} {action.symbol} — "
            f"{sentiment_str}, bearish={tc.bearish_count if tc else 0}, bullish={tc.bullish_count if tc else 0}. "
            f"Size={action.position_size_pct}, SL={action.stop_loss_pct}, TP={action.take_profit_pct}."
        )
