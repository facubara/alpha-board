"""Bar-by-bar backtest engine reusing existing indicators and strategies.

Replays historical Binance candles through the full
indicator -> scoring -> strategy pipeline.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from src.backtest.portfolio import SimPortfolio
from src.exchange.client import BinanceClient
from src.exchange.types import Candle, candles_to_dataframe
from src.indicators.registry import create_default_registry
from src.models.db import BacktestRun, BacktestTrade
from src.scoring.scorer import BullishScorer
from src.scoring.confidence import ConfidenceScorer
from src.scoring.ranker import Ranker, SymbolData
from src.agents.strategies import STRATEGY_REGISTRY
from src.agents.schemas import (
    ActionType,
    AgentContext,
    CrossTimeframeContext,
    Direction,
    PerformanceStats,
    PortfolioSummary,
    PositionInfo,
    RankingContext,
)

logger = logging.getLogger(__name__)

WARMUP_BARS = 200  # Indicators need 200 bars before signals are reliable


@dataclass
class BacktestConfig:
    """Configuration for a backtest run."""

    strategy: str
    timeframe: str
    symbol: str
    start_date: datetime
    end_date: datetime
    initial_balance: float = 10000.0


@dataclass
class BacktestResult:
    """Result of a completed backtest."""

    run_id: int
    status: str
    stats: dict | None = None
    error: str | None = None


class BacktestEngine:
    """Bar-by-bar backtest engine reusing existing indicators and strategies."""

    async def run(
        self, config: BacktestConfig, session: AsyncSession,
        run_id: int | None = None,
    ) -> BacktestResult:
        """Execute a full backtest and persist results.

        Args:
            config: Backtest configuration.
            session: Database session for persisting results.
            run_id: Existing BacktestRun row id to update (if None, creates one).

        Returns:
            BacktestResult with run_id and status.
        """
        if run_id is not None:
            # Use existing row created by the API endpoint
            from sqlalchemy import select as sa_select
            result = await session.execute(
                sa_select(BacktestRun).where(BacktestRun.id == run_id)
            )
            run = result.scalar_one()
            run.status = "running"
            await session.flush()
        else:
            run = BacktestRun(
                agent_name=f"bt-{config.strategy}",
                strategy_archetype=config.strategy,
                timeframe=config.timeframe,
                symbol=config.symbol,
                start_date=config.start_date,
                end_date=config.end_date,
                initial_balance=Decimal(str(config.initial_balance)),
                status="running",
            )
            session.add(run)
            await session.flush()
            run_id = run.id

        try:
            # 1. Fetch historical candles
            candles = await self._fetch_candles(
                config.symbol, config.timeframe,
                config.start_date, config.end_date,
            )

            if len(candles) < WARMUP_BARS + 10:
                raise ValueError(
                    f"Insufficient candles: got {len(candles)}, "
                    f"need at least {WARMUP_BARS + 10}"
                )

            logger.info(
                f"Backtest {run_id}: fetched {len(candles)} candles for "
                f"{config.symbol} {config.timeframe}"
            )

            # 2. Initialize components
            portfolio = SimPortfolio(config.initial_balance)
            registry = create_default_registry()
            strategy_cls = STRATEGY_REGISTRY.get(config.strategy)
            if not strategy_cls:
                raise ValueError(f"Unknown strategy: {config.strategy}")
            strategy = strategy_cls()

            scorer = BullishScorer()
            confidence_scorer = ConfidenceScorer()

            # 3. Bar-by-bar loop (starting after warmup)
            for i in range(WARMUP_BARS, len(candles)):
                # Periodic cancellation check — yields to event loop
                if i % 50 == 0:
                    await asyncio.sleep(0)

                candle = candles[i]
                timestamp = candle.open_time
                close_price = float(candle.close)
                prices = {config.symbol: close_price}

                # a. Build rolling window DataFrame
                window = candles[: i + 1]
                df = candles_to_dataframe(window)

                # b. Compute indicators
                indicators = registry.compute_all(df)

                # c. Score the symbol
                bullish_score = scorer.score(indicators)
                confidence = confidence_scorer.score(indicators)

                # d. Build ranking context
                # Extract indicator signals in same format as context builder
                signals_list = []
                for name, output in indicators.items():
                    sig = output["signal"]
                    signals_list.append({
                        "name": name,
                        "signal": sig["signal"],
                        "label": sig["label"],
                        "raw": output["raw"],
                        "rawValues": output["raw"],
                    })

                ranking = RankingContext(
                    symbol=config.symbol,
                    rank=1,
                    bullish_score=bullish_score,
                    confidence=int(round(confidence * 100)),
                    highlights=[],
                    indicator_signals=signals_list,
                )

                # e. Check SL/TP against current candle
                candle_data = {
                    config.symbol: {
                        "high": float(candle.high),
                        "low": float(candle.low),
                        "close": close_price,
                    }
                }
                portfolio.check_sl_tp(candle_data, timestamp)

                # f. Build minimal AgentContext
                context = self._build_context(
                    config, portfolio, [ranking], prices,
                )

                # g. Evaluate strategy
                action = strategy.evaluate(context)

                # h. Execute action
                if action.action in (ActionType.OPEN_LONG, ActionType.OPEN_SHORT):
                    if action.symbol and action.symbol == config.symbol:
                        direction = (
                            "long" if action.action == ActionType.OPEN_LONG
                            else "short"
                        )
                        portfolio.open_position(
                            symbol=config.symbol,
                            direction=direction,
                            price=close_price,
                            size_pct=action.position_size_pct or 0.10,
                            sl_pct=action.stop_loss_pct,
                            tp_pct=action.take_profit_pct,
                            timestamp=timestamp,
                            prices=prices,
                        )
                elif action.action == ActionType.CLOSE:
                    if action.symbol and action.symbol == config.symbol:
                        portfolio.close_position(
                            config.symbol, close_price,
                            "strategy", timestamp,
                        )

                # i. Snapshot equity
                portfolio.update_equity(prices, timestamp)

            # 4. Force-close remaining positions at last candle price
            last_candle = candles[-1]
            last_price = float(last_candle.close)
            last_ts = last_candle.open_time
            for symbol in list(portfolio.positions.keys()):
                portfolio.close_position(symbol, last_price, "backtest_end", last_ts)
            portfolio.update_equity({config.symbol: last_price}, last_ts)

            # 5. Compute stats
            stats = portfolio.get_stats()

            # 6. Persist results
            run.status = "completed"
            run.final_equity = Decimal(str(stats["final_equity"]))
            run.total_pnl = Decimal(str(stats["total_pnl"]))
            run.total_trades = stats["total_trades"]
            run.winning_trades = stats["winning_trades"]
            run.max_drawdown_pct = Decimal(str(stats["max_drawdown_pct"]))
            run.sharpe_ratio = (
                Decimal(str(stats["sharpe_ratio"]))
                if stats["sharpe_ratio"] is not None
                else None
            )
            run.equity_curve = stats["equity_curve"]
            run.completed_at = datetime.now(timezone.utc)

            # Persist trades
            for t in portfolio.trades:
                session.add(BacktestTrade(
                    run_id=run_id,
                    symbol=t.symbol,
                    direction=t.direction,
                    entry_price=Decimal(str(round(t.entry_price, 8))),
                    exit_price=Decimal(str(round(t.exit_price, 8))),
                    position_size=Decimal(str(round(t.position_size, 2))),
                    pnl=Decimal(str(round(t.pnl, 2))),
                    fees=Decimal(str(round(t.fees, 2))),
                    exit_reason=t.exit_reason,
                    entry_at=t.entry_at,
                    exit_at=t.exit_at,
                    duration_minutes=t.duration_minutes,
                ))

            await session.commit()

            logger.info(
                f"Backtest {run_id} completed: {stats['total_trades']} trades, "
                f"PnL=${stats['total_pnl']:.2f}"
            )

            return BacktestResult(run_id=run_id, status="completed", stats=stats)

        except asyncio.CancelledError:
            logger.info(f"Backtest {run_id} cancelled by user")
            run.status = "cancelled"
            run.error_message = "Cancelled by user"
            run.completed_at = datetime.now(timezone.utc)
            await session.commit()
            return BacktestResult(run_id=run_id, status="cancelled", error="Cancelled by user")

        except Exception as e:
            logger.exception(f"Backtest {run_id} failed: {e}")
            run.status = "failed"
            run.error_message = str(e)[:2000]
            run.completed_at = datetime.now(timezone.utc)
            await session.commit()
            return BacktestResult(run_id=run_id, status="failed", error=str(e))

    async def _fetch_candles(
        self,
        symbol: str,
        timeframe: str,
        start_date: datetime,
        end_date: datetime,
    ) -> list[Candle]:
        """Fetch all candles for date range, paginating if needed."""
        client = BinanceClient()
        all_candles: list[Candle] = []

        # We need WARMUP_BARS extra candles before start_date
        # Estimate candle duration in ms for pagination
        interval_ms = {
            "15m": 15 * 60 * 1000,
            "30m": 30 * 60 * 1000,
            "1h": 60 * 60 * 1000,
            "4h": 4 * 60 * 60 * 1000,
            "1d": 24 * 60 * 60 * 1000,
            "1w": 7 * 24 * 60 * 60 * 1000,
        }
        ms_per_candle = interval_ms.get(timeframe, 60 * 60 * 1000)

        # Calculate actual start including warmup
        warmup_ms = WARMUP_BARS * ms_per_candle
        actual_start_ms = int(start_date.timestamp() * 1000) - warmup_ms
        end_ms = int(end_date.timestamp() * 1000)

        current_start = actual_start_ms

        while current_start < end_ms:
            params = {
                "symbol": symbol,
                "interval": timeframe,
                "startTime": current_start,
                "endTime": end_ms,
                "limit": 1000,
            }
            data = await client._request("GET", client.KLINES_ENDPOINT, params)

            if not data:
                break

            for row in data:
                all_candles.append(Candle(
                    open_time=datetime.fromtimestamp(row[0] / 1000, tz=timezone.utc),
                    open=Decimal(row[1]),
                    high=Decimal(row[2]),
                    low=Decimal(row[3]),
                    close=Decimal(row[4]),
                    volume=Decimal(row[5]),
                    close_time=datetime.fromtimestamp(row[6] / 1000, tz=timezone.utc),
                    quote_volume=Decimal(row[7]),
                    trades=int(row[8]),
                ))

            # Move start to after the last candle
            last_close_time = data[-1][6]
            if last_close_time >= end_ms:
                break
            current_start = last_close_time + 1

            # Safety: if we got less than 1000, we've reached the end
            if len(data) < 1000:
                break

        return all_candles

    def _build_context(
        self,
        config: BacktestConfig,
        portfolio: SimPortfolio,
        rankings: list[RankingContext],
        prices: dict[str, float],
    ) -> AgentContext:
        """Build a minimal AgentContext for strategy evaluation."""
        summary = portfolio.get_portfolio_summary(prices)

        # Build PositionInfo list from open positions
        open_positions = []
        for pos_data in summary["open_positions"]:
            open_positions.append(PositionInfo(
                id=0,
                symbol=pos_data["symbol"],
                symbol_id=0,
                direction=Direction(pos_data["direction"]),
                entry_price=Decimal(str(pos_data["entry_price"])),
                position_size=Decimal(str(pos_data["position_size"])),
                stop_loss=(
                    Decimal(str(pos_data["stop_loss"]))
                    if pos_data["stop_loss"] else None
                ),
                take_profit=(
                    Decimal(str(pos_data["take_profit"]))
                    if pos_data["take_profit"] else None
                ),
                opened_at=datetime.now(timezone.utc),
                unrealized_pnl=Decimal("0"),
            ))

        portfolio_summary = PortfolioSummary(
            agent_id=0,
            cash_balance=Decimal(str(round(summary["cash_balance"], 2))),
            total_equity=Decimal(str(round(summary["total_equity"], 2))),
            total_realized_pnl=Decimal(str(round(
                summary["total_equity"] - portfolio.initial_balance, 2
            ))),
            total_fees_paid=Decimal("0"),
            open_positions=open_positions,
            position_count=summary["position_count"],
            available_for_new_position=Decimal(str(round(
                summary["available_for_new_position"], 2
            ))),
        )

        performance = PerformanceStats(
            total_trades=len(portfolio.trades),
            winning_trades=sum(1 for t in portfolio.trades if t.pnl > 0),
            losing_trades=sum(1 for t in portfolio.trades if t.pnl < 0),
            win_rate=(
                sum(1 for t in portfolio.trades if t.pnl > 0) / len(portfolio.trades)
                if portfolio.trades else 0.0
            ),
            total_pnl=Decimal(str(round(
                summary["total_equity"] - portfolio.initial_balance, 2
            ))),
            avg_pnl_per_trade=Decimal(str(round(
                sum(t.pnl for t in portfolio.trades) / len(portfolio.trades), 2
            ))) if portfolio.trades else Decimal("0"),
            max_drawdown=0.0,
        )

        decimal_prices = {k: Decimal(str(v)) for k, v in prices.items()}

        return AgentContext(
            agent_id=0,
            agent_name=f"bt-{config.strategy}",
            strategy_archetype=config.strategy,
            primary_timeframe=config.timeframe,
            portfolio=portfolio_summary,
            performance=performance,
            primary_timeframe_rankings=rankings,
            cross_timeframe_confluence=None,
            cross_timeframe_regime=None,
            current_prices=decimal_prices,
            recent_memory=[],
        )
