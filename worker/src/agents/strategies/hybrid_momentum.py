"""Hybrid Momentum strategy — technical momentum + tweet sentiment confirmation."""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class HybridMomentumStrategy(BaseRuleStrategy):
    """Follow the trend with tweet sentiment as confirmation/boost.

    Base entry: same as MomentumStrategy (RSI, MACD, ADX, EMA, OBV).
    Tweet boost: if avg_sentiment > 0.3 and bullish_count >= 2, relax bullish_score
                 threshold to 0.60 (from 0.70) and increase size to 0.20.
    Tweet conflict: if tweet sentiment opposes direction, skip entry.
    Exit: same technical exits + close if tweet sentiment strongly reverses.
    Falls back to pure technical when tweet_context is None.
    """

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exits
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open?
        if not self._can_open(context):
            return self._hold(0.1)

        # 3. Don't overtrade
        if context.portfolio.position_count >= 3:
            return self._hold(0.1)

        tc = context.tweet_context

        # 4. Scan rankings for entry signals
        for r in context.primary_timeframe_rankings:
            if self._has_position(context, r.symbol):
                continue

            rsi = self._raw(r, "rsi_14", "value")
            macd_hist = self._raw(r, "macd_12_26_9", "histogram")
            adx = self._raw(r, "adx_14", "adx")
            plus_di = self._raw(r, "adx_14", "plus_di")
            minus_di = self._raw(r, "adx_14", "minus_di")
            obv_slope = self._raw(r, "obv", "slope_normalized")
            pve50 = self._raw(r, "ema_50", "price_vs_ema_pct")
            pve200 = self._raw(r, "ema_200", "price_vs_ema_pct")

            if not all(v is not None for v in [rsi, macd_hist, adx, plus_di, minus_di, obv_slope, pve50, pve200]):
                continue

            # Determine tweet boost / conflict for long
            long_boosted = False
            long_conflict = False
            if tc and tc.signals:
                if tc.avg_sentiment > 0.3 and tc.bullish_count >= 2:
                    long_boosted = True
                if tc.avg_sentiment < -0.2:
                    long_conflict = True

            # ── Long entry ───────────────────────────────────────
            bullish_threshold = 0.60 if long_boosted else 0.70
            if (
                r.bullish_score >= bullish_threshold
                and r.confidence >= 60
                and 50 <= rsi <= 70
                and macd_hist > 0
                and adx > 25
                and plus_di > minus_di
                and pve50 > 0
                and pve200 > 0
                and obv_slope > 0
                and self._regime_allows_direction(context, "long")
                and not long_conflict
            ):
                size = 0.20 if long_boosted else (0.15 if r.confidence >= 75 else 0.08)
                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.04,
                    take_profit_pct=0.06,
                    confidence=r.bullish_score,
                )

            # Determine tweet boost / conflict for short
            short_boosted = False
            short_conflict = False
            if tc and tc.signals:
                if tc.avg_sentiment < -0.3 and tc.bearish_count >= 2:
                    short_boosted = True
                if tc.avg_sentiment > 0.2:
                    short_conflict = True

            # ── Short entry ──────────────────────────────────────
            bearish_threshold = 0.40 if short_boosted else 0.30
            if (
                r.bullish_score <= bearish_threshold
                and r.confidence >= 60
                and 30 <= rsi <= 50
                and macd_hist < 0
                and adx > 25
                and minus_di > plus_di
                and pve50 < 0
                and pve200 < 0
                and self._regime_allows_direction(context, "short")
                and not short_conflict
            ):
                size = 0.20 if short_boosted else (0.15 if r.confidence >= 75 else 0.08)
                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.04,
                    take_profit_pct=0.06,
                    confidence=1.0 - r.bullish_score,
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit long: RSI > 75 or price < EMA20. Short inverse.
        Also exit if tweet sentiment strongly reverses (>= 3 opposing signals).
        """
        tc = context.tweet_context

        for pos in context.portfolio.open_positions:
            r = next((x for x in context.primary_timeframe_rankings if x.symbol == pos.symbol), None)
            if not r:
                continue

            rsi = self._raw(r, "rsi_14", "value")
            pve20 = self._raw(r, "ema_20", "price_vs_ema_pct")
            if rsi is None or pve20 is None:
                continue

            # Technical exits
            if pos.direction.value == "long" and (rsi > 75 or pve20 < 0):
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.8)
            if pos.direction.value == "short" and (rsi < 25 or pve20 > 0):
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.8)

            # Tweet sentiment reversal exit
            if tc and tc.signals:
                if pos.direction.value == "long" and tc.avg_sentiment < -0.3 and tc.bearish_count >= 3:
                    return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)
                if pos.direction.value == "short" and tc.avg_sentiment > 0.3 and tc.bullish_count >= 3:
                    return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.7)

        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        tc = context.tweet_context
        tweet_str = f", tweet_sentiment={tc.avg_sentiment:.2f}" if tc else ", no tweet data (pure technical)"

        if action.action == ActionType.HOLD:
            return f"HybridMomentum: no entry/exit conditions met{tweet_str}. Holding."
        if action.action == ActionType.CLOSE:
            return f"HybridMomentum: closing {action.symbol} — exit signal triggered{tweet_str}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return (
            f"HybridMomentum: opening {direction} {action.symbol} — "
            f"size={action.position_size_pct}, SL={action.stop_loss_pct}, TP={action.take_profit_pct}, "
            f"confidence={action.confidence:.2f}{tweet_str}."
        )
