"""Context builder for agent decision-making.

Assembles all data an agent needs to make a decision:
- Portfolio state and performance
- Rankings for the agent's timeframe
- Cross-timeframe confluence signals
- Recent memory entries
- Current prices for open positions
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.db import (
    Agent,
    AgentPortfolio,
    AgentPosition,
    AgentTrade,
    AgentMemory,
    Snapshot,
    Symbol,
    TimeframeRegime,
    Tweet,
    TweetSignal,
    TwitterAccount,
)
from src.agents.schemas import (
    AgentContext,
    CrossTimeframeContext,
    PortfolioSummary,
    PositionInfo,
    PerformanceStats,
    RankingContext,
    RegimeLabel,
    TweetContext,
    TweetSignalContext,
    Direction,
)


class ContextBuilder:
    """Builds context for agent decision-making."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def build(
        self,
        agent: Agent,
        current_prices: dict[str, Decimal] | None = None,
    ) -> AgentContext:
        """Build complete context for an agent.

        Args:
            agent: The agent to build context for.
            current_prices: Optional dict of symbol -> current price.
                            If not provided, uses last close from rankings.

        Returns:
            AgentContext with all data needed for decision-making.
        """
        # Fetch portfolio and positions
        portfolio = await self._get_portfolio_summary(agent.id, current_prices or {})

        # Fetch performance stats
        performance = await self._get_performance_stats(agent.id)

        # Fetch rankings for agent's timeframe
        rankings = await self._get_rankings(agent.timeframe)

        # Build current prices map from rankings if not provided
        if not current_prices:
            current_prices = {}
            # Rankings don't include price directly, would need to fetch from exchange
            # For now, leave empty - executor will fetch if needed

        # Fetch recent memory
        memory = await self._get_recent_memory(agent.id, limit=20)

        # Build cross-timeframe confluence (optional enhancement)
        confluence = await self._get_cross_timeframe_confluence(agent.timeframe)

        # Build regime context from persisted regime labels
        regime_context = await self._get_regime_context(agent.timeframe)

        # Build tweet context for tweet/hybrid agents
        tweet_context = None
        source = getattr(agent, "source", "technical")
        if source in ("tweet", "hybrid"):
            tweet_context = await self._get_tweet_context(agent.timeframe)

        return AgentContext(
            agent_id=agent.id,
            agent_name=agent.name,
            strategy_archetype=agent.strategy_archetype,
            primary_timeframe=agent.timeframe,
            portfolio=portfolio,
            performance=performance,
            primary_timeframe_rankings=rankings,
            cross_timeframe_confluence=confluence,
            cross_timeframe_regime=regime_context,
            tweet_context=tweet_context,
            current_prices=current_prices,
            recent_memory=memory,
            context_built_at=datetime.now(timezone.utc),
        )

    async def _get_portfolio_summary(
        self,
        agent_id: int,
        current_prices: dict[str, Decimal],
    ) -> PortfolioSummary:
        """Get portfolio summary for an agent."""
        # Fetch portfolio
        result = await self.session.execute(
            select(AgentPortfolio).where(AgentPortfolio.agent_id == agent_id)
        )
        portfolio = result.scalar_one_or_none()

        if not portfolio:
            # Return empty portfolio
            return PortfolioSummary(
                agent_id=agent_id,
                cash_balance=Decimal("10000.00"),
                total_equity=Decimal("10000.00"),
                total_realized_pnl=Decimal("0.00"),
                total_fees_paid=Decimal("0.00"),
                open_positions=[],
                position_count=0,
                available_for_new_position=Decimal("2500.00"),  # 25% max
            )

        # Fetch open positions with symbol info
        result = await self.session.execute(
            select(AgentPosition, Symbol)
            .join(Symbol, AgentPosition.symbol_id == Symbol.id)
            .where(AgentPosition.agent_id == agent_id)
        )
        position_rows = result.all()

        positions: list[PositionInfo] = []
        for pos, sym in position_rows:
            current_price = current_prices.get(sym.symbol)
            pnl_pct = None

            if current_price:
                if pos.direction == "long":
                    pnl_pct = float(
                        (current_price - pos.entry_price) / pos.entry_price * 100
                    )
                else:
                    pnl_pct = float(
                        (pos.entry_price - current_price) / pos.entry_price * 100
                    )

            positions.append(
                PositionInfo(
                    id=pos.id,
                    symbol=sym.symbol,
                    symbol_id=pos.symbol_id,
                    direction=Direction(pos.direction),
                    entry_price=pos.entry_price,
                    position_size=pos.position_size,
                    stop_loss=pos.stop_loss,
                    take_profit=pos.take_profit,
                    opened_at=pos.opened_at,
                    unrealized_pnl=pos.unrealized_pnl,
                    current_price=current_price,
                    pnl_pct=pnl_pct,
                )
            )

        # Calculate available for new position
        # Max 25% of equity, max 5 concurrent positions
        max_position_size = portfolio.total_equity * Decimal("0.25")
        positions_available = 5 - len(positions)
        available = min(portfolio.cash_balance, max_position_size) if positions_available > 0 else Decimal("0.00")

        return PortfolioSummary(
            agent_id=agent_id,
            cash_balance=portfolio.cash_balance,
            total_equity=portfolio.total_equity,
            total_realized_pnl=portfolio.total_realized_pnl,
            total_fees_paid=portfolio.total_fees_paid,
            open_positions=positions,
            position_count=len(positions),
            available_for_new_position=available,
        )

    async def _get_performance_stats(self, agent_id: int) -> PerformanceStats:
        """Calculate performance statistics for an agent."""
        # Fetch all trades
        result = await self.session.execute(
            select(AgentTrade).where(AgentTrade.agent_id == agent_id)
        )
        trades = result.scalars().all()

        if not trades:
            return PerformanceStats(
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                win_rate=0.0,
                total_pnl=Decimal("0.00"),
                avg_pnl_per_trade=Decimal("0.00"),
                max_drawdown=0.0,
            )

        total_trades = len(trades)
        winning_trades = sum(1 for t in trades if t.pnl > 0)
        losing_trades = sum(1 for t in trades if t.pnl < 0)
        total_pnl = sum(t.pnl for t in trades)
        avg_pnl = total_pnl / total_trades if total_trades > 0 else Decimal("0.00")
        win_rate = winning_trades / total_trades if total_trades > 0 else 0.0

        # Calculate max drawdown (simplified)
        cumulative_pnl = Decimal("0.00")
        peak = Decimal("0.00")
        max_dd = 0.0

        for trade in sorted(trades, key=lambda t: t.closed_at):
            cumulative_pnl += trade.pnl
            if cumulative_pnl > peak:
                peak = cumulative_pnl
            if peak > 0:
                dd = float((peak - cumulative_pnl) / peak)
                max_dd = max(max_dd, dd)

        # Average trade duration
        total_duration = sum(t.duration_minutes for t in trades)
        avg_duration_hours = (total_duration / total_trades / 60) if total_trades > 0 else None

        return PerformanceStats(
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            total_pnl=total_pnl,
            avg_pnl_per_trade=avg_pnl,
            max_drawdown=max_dd,
            avg_trade_duration_hours=avg_duration_hours,
        )

    async def _get_rankings(self, timeframe: str) -> list[RankingContext]:
        """Get latest rankings for a timeframe."""
        # Get latest computation time
        subquery = (
            select(func.max(Snapshot.computed_at))
            .where(Snapshot.timeframe == timeframe)
            .scalar_subquery()
        )

        result = await self.session.execute(
            select(Snapshot, Symbol)
            .join(Symbol, Snapshot.symbol_id == Symbol.id)
            .where(Snapshot.timeframe == timeframe)
            .where(Snapshot.computed_at == subquery)
            .order_by(Snapshot.rank)
            .limit(50)  # Top 50 symbols
        )
        rows = result.all()

        rankings: list[RankingContext] = []
        for snap, sym in rows:
            # Convert indicator_signals from dict-keyed format to list format
            raw_signals = snap.indicator_signals or {}
            if isinstance(raw_signals, dict):
                signals_list = [
                    {"name": name, **data}
                    for name, data in raw_signals.items()
                ]
            else:
                signals_list = raw_signals

            rankings.append(
                RankingContext(
                    symbol=sym.symbol,
                    rank=snap.rank,
                    bullish_score=float(snap.bullish_score),
                    confidence=snap.confidence,
                    highlights=snap.highlights or [],
                    indicator_signals=signals_list,
                )
            )

        return rankings

    async def _get_recent_memory(self, agent_id: int, limit: int = 20) -> list[str]:
        """Get recent memory entries for an agent."""
        result = await self.session.execute(
            select(AgentMemory)
            .where(AgentMemory.agent_id == agent_id)
            .order_by(AgentMemory.created_at.desc())
            .limit(limit)
        )
        memories = result.scalars().all()

        return [m.lesson for m in memories]

    async def _get_regime_context(
        self, primary_timeframe: str
    ) -> CrossTimeframeContext | None:
        """Build cross-timeframe regime context from persisted regime labels.

        Queries all rows from timeframe_regimes, builds RegimeLabel per TF,
        and computes higher_tf_trend from 4h + 1d regimes.
        """
        try:
            result = await self.session.execute(select(TimeframeRegime))
            rows = result.scalars().all()

            if not rows:
                return None

            regimes: dict[str, RegimeLabel] = {}
            for row in rows:
                regimes[row.timeframe] = RegimeLabel(
                    timeframe=row.timeframe,
                    regime=row.regime,
                    confidence=float(row.confidence),
                    avg_bullish_score=float(row.avg_bullish_score) if row.avg_bullish_score else 0.5,
                    computed_at=row.computed_at,
                )

            # Compute higher_tf_trend from 4h + 1d regimes
            higher_tf_trend = "ranging"
            higher_tf_confidence = 0.0

            regime_4h = regimes.get("4h")
            regime_1d = regimes.get("1d")

            if regime_4h and regime_1d:
                r4h = regime_4h.regime
                r1d = regime_1d.regime
                avg_conf = (regime_4h.confidence + regime_1d.confidence) / 2

                if "bull" in r4h and "bull" in r1d:
                    higher_tf_trend = "bull"
                    higher_tf_confidence = avg_conf
                elif "bear" in r4h and "bear" in r1d:
                    higher_tf_trend = "bear"
                    higher_tf_confidence = avg_conf
                elif r4h == "ranging" and r1d == "ranging":
                    higher_tf_trend = "ranging"
                    higher_tf_confidence = avg_conf
                else:
                    higher_tf_trend = "mixed"
                    higher_tf_confidence = avg_conf * 0.5
            elif regime_1d:
                # Only 1d available
                if "bull" in regime_1d.regime:
                    higher_tf_trend = "bull"
                elif "bear" in regime_1d.regime:
                    higher_tf_trend = "bear"
                else:
                    higher_tf_trend = regime_1d.regime
                higher_tf_confidence = regime_1d.confidence * 0.7

            return CrossTimeframeContext(
                regimes=regimes,
                higher_tf_trend=higher_tf_trend,
                higher_tf_confidence=higher_tf_confidence,
            )
        except Exception:
            return None

    # Timeframe → lookback hours for tweet context
    TWEET_LOOKBACK_HOURS: dict[str, float] = {
        "15m": 1,
        "30m": 2,
        "1h": 4,
        "4h": 12,
        "1d": 48,
        "1w": 168,
    }

    async def _get_tweet_context(self, timeframe: str) -> TweetContext | None:
        """Build tweet context from recent tweet signals.

        Args:
            timeframe: Agent timeframe, determines lookback window.

        Returns:
            TweetContext with aggregated signals, or None if no signals.
        """
        try:
            lookback_hours = self.TWEET_LOOKBACK_HOURS.get(timeframe, 4)
            cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)

            result = await self.session.execute(
                select(TweetSignal, Tweet, TwitterAccount)
                .join(Tweet, TweetSignal.tweet_id == Tweet.id)
                .join(TwitterAccount, Tweet.twitter_account_id == TwitterAccount.id)
                .where(Tweet.created_at >= cutoff)
                .order_by(Tweet.created_at.desc())
            )
            rows = result.all()

            if not rows:
                return None

            signals: list[TweetSignalContext] = []
            symbol_counts: dict[str, int] = {}
            total_sentiment = 0.0
            bullish_count = 0
            bearish_count = 0

            for signal, tweet, account in rows:
                metrics = tweet.metrics or {}
                signals.append(TweetSignalContext(
                    handle=account.handle,
                    category=account.category,
                    text=tweet.text,
                    sentiment_score=float(signal.sentiment_score),
                    setup_type=signal.setup_type or "neutral",
                    confidence=float(signal.confidence),
                    symbols_mentioned=signal.symbols_mentioned or [],
                    reasoning=signal.reasoning,
                    likes=metrics.get("like_count", 0),
                    retweets=metrics.get("retweet_count", 0),
                    tweeted_at=tweet.created_at,
                ))

                sentiment = float(signal.sentiment_score)
                total_sentiment += sentiment
                if sentiment > 0.2:
                    bullish_count += 1
                elif sentiment < -0.2:
                    bearish_count += 1

                for sym in (signal.symbols_mentioned or []):
                    symbol_counts[sym] = symbol_counts.get(sym, 0) + 1

            avg_sentiment = total_sentiment / len(signals) if signals else 0.0

            # Top 5 most mentioned symbols
            most_mentioned = sorted(symbol_counts.keys(), key=lambda s: -symbol_counts[s])[:5]

            return TweetContext(
                signals=signals,
                avg_sentiment=avg_sentiment,
                bullish_count=bullish_count,
                bearish_count=bearish_count,
                most_mentioned_symbols=most_mentioned,
                lookback_hours=lookback_hours,
            )
        except Exception:
            return None

    async def _get_cross_timeframe_confluence(
        self, primary_timeframe: str
    ) -> dict[str, Any] | None:
        """Detect cross-timeframe confluence signals.

        Compares signals across timeframes to find:
        - Confluence: same direction across multiple timeframes
        - Divergence: conflicting signals
        """
        # Define timeframe hierarchy
        timeframes = ["15m", "30m", "1h", "4h", "1d", "1w"]

        # Get top 10 from each timeframe
        confluence_data: dict[str, dict[str, float]] = {}

        for tf in timeframes:
            rankings = await self._get_rankings(tf)
            for r in rankings[:10]:
                if r.symbol not in confluence_data:
                    confluence_data[r.symbol] = {}
                confluence_data[r.symbol][tf] = r.bullish_score

        # Find symbols with confluence (bullish or bearish across 3+ timeframes)
        bullish_confluence: list[str] = []
        bearish_confluence: list[str] = []

        for symbol, scores in confluence_data.items():
            if len(scores) < 3:
                continue

            bullish_count = sum(1 for s in scores.values() if s > 0.6)
            bearish_count = sum(1 for s in scores.values() if s < 0.4)

            if bullish_count >= 3:
                bullish_confluence.append(symbol)
            elif bearish_count >= 3:
                bearish_confluence.append(symbol)

        return {
            "bullish_confluence": bullish_confluence[:5],
            "bearish_confluence": bearish_confluence[:5],
            "timeframes_analyzed": len(timeframes),
            "symbol_tf_scores": confluence_data,
        }
