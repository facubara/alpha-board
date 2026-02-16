"""Tweet-based Momentum strategy — ride the social media hype."""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class TweetMomentumStrategy(BaseRuleStrategy):
    """Open positions when multiple credible accounts are bullish.

    Entry Long: avg_sentiment >= 0.4, bullish_count >= 3, top symbol has >= 2 bullish mentions.
    Entry Short: avg_sentiment <= -0.4, bearish_count >= 3.
    Exit: sentiment reverses (flips sign) or confidence drops below 0.3.
    Sizing: 12%. SL 4%, TP 8%.
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

        # Count bullish mentions per symbol
        symbol_bullish: dict[str, int] = {}
        for sig in tc.signals:
            if sig.sentiment_score >= 0.3:
                for sym in sig.symbols_mentioned:
                    symbol_bullish[sym] = symbol_bullish.get(sym, 0) + 1

        # Long entry
        if tc.avg_sentiment >= 0.4 and tc.bullish_count >= 3:
            # Find best symbol with >= 2 bullish mentions
            for sym in tc.most_mentioned_symbols:
                if symbol_bullish.get(sym, 0) >= 2 and not self._has_position(context, sym):
                    return TradeAction(
                        action=ActionType.OPEN_LONG,
                        symbol=sym,
                        position_size_pct=0.12,
                        stop_loss_pct=0.04,
                        take_profit_pct=0.08,
                        confidence=min(tc.avg_sentiment, 1.0),
                    )

        # Short entry
        if tc.avg_sentiment <= -0.4 and tc.bearish_count >= 3:
            symbol_bearish: dict[str, int] = {}
            for sig in tc.signals:
                if sig.sentiment_score <= -0.3:
                    for sym in sig.symbols_mentioned:
                        symbol_bearish[sym] = symbol_bearish.get(sym, 0) + 1

            for sym in tc.most_mentioned_symbols:
                if symbol_bearish.get(sym, 0) >= 2 and not self._has_position(context, sym):
                    return TradeAction(
                        action=ActionType.OPEN_SHORT,
                        symbol=sym,
                        position_size_pct=0.12,
                        stop_loss_pct=0.04,
                        take_profit_pct=0.08,
                        confidence=min(abs(tc.avg_sentiment), 1.0),
                    )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        tc = context.tweet_context
        if not tc:
            return None

        for pos in context.portfolio.open_positions:
            # Sentiment reversal or low confidence
            avg_conf = (
                sum(s.confidence for s in tc.signals) / len(tc.signals)
                if tc.signals
                else 0
            )

            if pos.direction.value == "long" and tc.avg_sentiment < 0:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
            if pos.direction.value == "short" and tc.avg_sentiment > 0:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
            if avg_conf < 0.3:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.5)

        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        tc = context.tweet_context
        sentiment_str = f"avg_sentiment={tc.avg_sentiment:.2f}" if tc else "no tweet data"

        if action.action == ActionType.HOLD:
            return f"TweetMomentum: no entry conditions met. {sentiment_str}. Holding."
        if action.action == ActionType.CLOSE:
            return f"TweetMomentum: closing {action.symbol} — sentiment reversed or confidence dropped. {sentiment_str}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return (
            f"TweetMomentum: opening {direction} {action.symbol} — "
            f"{sentiment_str}, bullish={tc.bullish_count if tc else 0}, bearish={tc.bearish_count if tc else 0}. "
            f"Size={action.position_size_pct}, SL={action.stop_loss_pct}, TP={action.take_profit_pct}."
        )
