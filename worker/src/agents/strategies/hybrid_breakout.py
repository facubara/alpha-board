"""Hybrid Breakout strategy — technical breakout + tweet sentiment confirmation."""

from src.agents.schemas import ActionType, AgentContext, TradeAction
from src.agents.strategies.base import BaseRuleStrategy


class HybridBreakoutStrategy(BaseRuleStrategy):
    """Trade range breaks with volume confirmation and tweet boost.

    Base entry: same as BreakoutStrategy (BB squeeze + breakout, volume surge, ADX).
    Tweet boost: if breakout symbol appears in most_mentioned_symbols → boost size.
    Tweet conflict: if tweet sentiment opposes breakout direction, reduce size by 50%.
    Exit: same technical exits (false breakout detection).
    Falls back to pure technical when tweet_context is None.
    """

    def evaluate(self, context: AgentContext) -> TradeAction:
        # 1. Check exits (false breakout detection)
        close = self._check_exits(context)
        if close:
            return close

        # 2. Can we open?
        if not self._can_open(context):
            return self._hold(0.1)

        tc = context.tweet_context

        # 3. Scan for breakout setups
        for r in context.primary_timeframe_rankings:
            if self._has_position(context, r.symbol):
                continue

            bandwidth = self._raw(r, "bbands_20_2", "bandwidth")
            pct_b = self._raw(r, "bbands_20_2", "percent_b")
            obv_slope = self._raw(r, "obv", "slope_normalized")
            adx = self._raw(r, "adx_14", "adx")
            plus_di = self._raw(r, "adx_14", "plus_di")
            minus_di = self._raw(r, "adx_14", "minus_di")

            if not all(v is not None for v in [bandwidth, pct_b, obv_slope, adx]):
                continue

            # Squeeze condition: low bandwidth
            is_squeeze = bandwidth < 5

            # Tweet context helpers
            symbol_mentioned = False
            if tc and tc.most_mentioned_symbols:
                symbol_mentioned = r.symbol in tc.most_mentioned_symbols

            # ── Long breakout ────────────────────────────────────
            if (
                is_squeeze
                and pct_b > 1.0  # price above upper BB
                and obv_slope > 2.0  # volume spike
                and adx < 25  # trend emerging, not mature
                and 0.55 <= r.bullish_score <= 0.75
                and self._regime_allows_direction(context, "long")
            ):
                size = 0.08
                # Tweet boost: symbol is being talked about
                if symbol_mentioned:
                    size = 0.12
                # Tweet conflict: negative sentiment opposes long breakout
                if tc and tc.signals and tc.avg_sentiment < -0.2:
                    size = size * 0.5

                return TradeAction(
                    action=ActionType.OPEN_LONG,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.05,
                    take_profit_pct=0.10,
                    confidence=0.65,
                )

            # ── Short breakout ───────────────────────────────────
            if (
                is_squeeze
                and pct_b < 0.0  # price below lower BB
                and obv_slope < -2.0  # volume spike down
                and adx < 25
                and plus_di is not None
                and minus_di is not None
                and minus_di > plus_di
                and self._regime_allows_direction(context, "short")
            ):
                size = 0.08
                # Tweet boost: symbol is being talked about
                if symbol_mentioned:
                    size = 0.12
                # Tweet conflict: positive sentiment opposes short breakout
                if tc and tc.signals and tc.avg_sentiment > 0.2:
                    size = size * 0.5

                return TradeAction(
                    action=ActionType.OPEN_SHORT,
                    symbol=r.symbol,
                    position_size_pct=size,
                    stop_loss_pct=0.05,
                    take_profit_pct=0.10,
                    confidence=0.65,
                )

        return self._hold(0.2)

    def _check_exits(self, context: AgentContext) -> TradeAction | None:
        """Exit if price re-enters BB (false breakout)."""
        for pos in context.portfolio.open_positions:
            r = next((x for x in context.primary_timeframe_rankings if x.symbol == pos.symbol), None)
            if not r:
                continue

            pct_b = self._raw(r, "bbands_20_2", "percent_b")
            if pct_b is None:
                continue

            # False breakout: price returned inside bands
            if pos.direction.value == "long" and 0.0 <= pct_b <= 1.0:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.75)
            if pos.direction.value == "short" and 0.0 <= pct_b <= 1.0:
                return TradeAction(action=ActionType.CLOSE, symbol=pos.symbol, confidence=0.75)
        return None

    def generate_reasoning(self, context: AgentContext, action: TradeAction) -> str:
        tc = context.tweet_context
        tweet_str = f", tweet_sentiment={tc.avg_sentiment:.2f}" if tc else ", no tweet data (pure technical)"

        if action.action == ActionType.HOLD:
            return f"HybridBreakout: no BB squeeze + breakout conditions detected{tweet_str}. Holding."
        if action.action == ActionType.CLOSE:
            return f"HybridBreakout: closing {action.symbol} — false breakout, price re-entered BB{tweet_str}."
        direction = "LONG" if action.action == ActionType.OPEN_LONG else "SHORT"
        return f"HybridBreakout: opening {direction} {action.symbol} — BB squeeze breakout with volume{tweet_str}."
