"""Hybrid Mean Reversion strategy — technical mean reversion + tweet sentiment confirmation."""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class HybridMeanReversionStrategy(BaseRuleStrategy):
    """Buy dips in uptrends, short rallies in downtrends, with tweet confirmation.

    Base entry: same as MeanReversionStrategy (RSI oversold/overbought, Bollinger Band, Stoch).
    Tweet boost: extreme tweet fear (avg_sentiment <= -0.5) confirms oversold long → increase size.
    Tweet conflict: if tweets are euphoric during oversold signal, skip (crowd agrees = not contrarian).
    Exit: same technical exits.
    Falls back to pure technical when tweet_context is None.
    """

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exits first
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open?
        if not self._can_open(context):
            return self._hold(0.1)

        tc = context.tweet_context

        # 3. Scan rankings
        for r in context.primary_timeframe_rankings:
            if self._has_position(context, r.symbol):
                continue

            rsi = self._raw(r, "rsi_14", "value")
            pve200 = self._raw(r, "ema_200", "price_vs_ema_pct")
            pct_b = self._raw(r, "bbands_20_2", "percent_b")
            stoch_k = self._raw(r, "stoch_14_3_3", "k")
            stoch_d = self._raw(r, "stoch_14_3_3", "d")

            if not all(v is not None for v in [rsi, pve200, pct_b, stoch_k, stoch_d]):
                continue

            # ── Long entry: uptrend + oversold ───────────────────
            if (
                pve200 > 0  # uptrend
                and (rsi < 30 or pct_b < 0.05)  # oversold
                and stoch_k < 20
                and stoch_k > stoch_d  # turning up
                and 0.20 <= r.bullish_score <= 0.45
                and self._regime_allows_direction(context, "long")
            ):
                # Tweet conflict: euphoric tweets during oversold = crowd agrees, not contrarian
                if tc and tc.signals and tc.avg_sentiment >= 0.4 and tc.bullish_count >= 3:
                    continue  # skip — crowd is too bullish for a contrarian long

                # Tweet boost: extreme fear confirms oversold
                size = 0.10
                if tc and tc.signals and tc.avg_sentiment <= -0.5:
                    size = 0.15  # boost size on extreme fear

                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.03,
                    take_profit_pct=0.04,
                    confidence=0.6,
                )

            # ── Short entry: downtrend + overbought ──────────────
            if (
                pve200 < 0  # downtrend
                and (rsi > 70 or pct_b > 0.95)  # overbought
                and stoch_k > 80
                and stoch_k < stoch_d  # turning down
                and self._regime_allows_direction(context, "short")
            ):
                # Tweet conflict: fearful tweets during overbought = crowd agrees, not contrarian
                if tc and tc.signals and tc.avg_sentiment <= -0.4 and tc.bearish_count >= 3:
                    continue  # skip — crowd is too bearish for a contrarian short

                # Tweet boost: extreme greed confirms overbought
                size = 0.10
                if tc and tc.signals and tc.avg_sentiment >= 0.5:
                    size = 0.15  # boost size on extreme greed

                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.03,
                    take_profit_pct=0.04,
                    confidence=0.6,
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit when price returns to mean (EMA20) or RSI normalizes."""
        for pos in context.portfolio.open_positions:
            r = next((x for x in context.primary_timeframe_rankings if x.symbol == pos.symbol), None)
            if not r:
                continue

            rsi = self._raw(r, "rsi_14", "value")
            pve20 = self._raw(r, "ema_20", "price_vs_ema_pct")
            if rsi is None or pve20 is None:
                continue

            if pos.direction.value == "long" and (abs(pve20) < 0.3 or 50 <= rsi <= 60):
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
            if pos.direction.value == "short" and (abs(pve20) < 0.3 or 40 <= rsi <= 50):
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        tc = context.tweet_context
        tweet_str = f", tweet_sentiment={tc.avg_sentiment:.2f}" if tc else ", no tweet data (pure technical)"

        if action.action == ActionType.HOLD:
            return f"HybridMeanReversion: no oversold/overbought conditions{tweet_str}. Holding."
        if action.action == ActionType.CLOSE:
            return f"HybridMeanReversion: closing {action.symbol} — price reverted to mean{tweet_str}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return f"HybridMeanReversion: opening {direction} {action.symbol} — extreme reading in trending context{tweet_str}."
