"""Rankings pipeline orchestration.

The PipelineRunner coordinates the full ranking pipeline:
1. Fetch active symbols from Binance
2. Fetch OHLCV candles for each symbol
3. Compute indicators for each symbol
4. Score and rank all symbols
5. Persist snapshots to database
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import async_session
from src.exchange import BinanceClient, candles_to_dataframe, Symbol as BinanceSymbol
from src.indicators import create_default_registry
from src.models.db import ComputationRun, Snapshot, Symbol
from src.scoring import Ranker, SymbolData

logger = logging.getLogger(__name__)

# Timeframe configurations
TIMEFRAME_CONFIG = {
    "15m": {"interval": "15m", "candles": 200, "cadence_minutes": 5},
    "30m": {"interval": "30m", "candles": 200, "cadence_minutes": 10},
    "1h": {"interval": "1h", "candles": 200, "cadence_minutes": 15},
    "4h": {"interval": "4h", "candles": 200, "cadence_minutes": 60},
    "1d": {"interval": "1d", "candles": 200, "cadence_minutes": 240},
    "1w": {"interval": "1w", "candles": 200, "cadence_minutes": 1440},
}

# Advisory lock ID for pipeline runs (arbitrary unique number)
PIPELINE_LOCK_ID = 123456789


class PipelineRunner:
    """Orchestrates the full ranking pipeline.

    The pipeline fetches market data, computes indicators, scores symbols,
    and persists rankings to the database.
    """

    def __init__(
        self,
        binance_client: BinanceClient | None = None,
        min_volume_usd: float = 1_000_000,
    ):
        """Initialize the pipeline runner.

        Args:
            binance_client: Custom Binance client (default: creates new one).
            min_volume_usd: Minimum 24h volume for symbol inclusion.
        """
        self.client = binance_client or BinanceClient()
        self.min_volume_usd = min_volume_usd
        self.registry = create_default_registry()
        self.ranker = Ranker()

    async def _acquire_lock(self, session: AsyncSession, timeframe: str) -> bool:
        """Try to acquire advisory lock for this timeframe.

        Args:
            session: Database session.
            timeframe: Timeframe being processed.

        Returns:
            True if lock acquired, False if already locked.
        """
        # Use timeframe hash + base lock ID for unique lock per timeframe
        lock_id = PIPELINE_LOCK_ID + hash(timeframe) % 1000
        result = await session.execute(
            text(f"SELECT pg_try_advisory_lock({lock_id})")
        )
        acquired = result.scalar()
        if acquired:
            logger.info(f"Acquired advisory lock for {timeframe} (lock_id={lock_id})")
        else:
            logger.warning(f"Could not acquire lock for {timeframe} - another run in progress")
        return acquired

    async def _release_lock(self, session: AsyncSession, timeframe: str) -> None:
        """Release advisory lock for this timeframe."""
        lock_id = PIPELINE_LOCK_ID + hash(timeframe) % 1000
        await session.execute(text(f"SELECT pg_advisory_unlock({lock_id})"))
        logger.info(f"Released advisory lock for {timeframe}")

    async def _ensure_symbols(
        self, session: AsyncSession, binance_symbols: list[BinanceSymbol]
    ) -> dict[str, int]:
        """Ensure all symbols exist in database, return symbol_id mapping.

        Args:
            session: Database session.
            binance_symbols: List of symbols from Binance.

        Returns:
            Dict mapping symbol name to database ID.
        """
        symbol_ids: dict[str, int] = {}

        for sym in binance_symbols:
            # Upsert symbol
            stmt = insert(Symbol).values(
                symbol=sym.symbol,
                base_asset=sym.base_asset,
                quote_asset=sym.quote_asset,
                is_active=True,
                last_seen_at=datetime.now(timezone.utc),
            ).on_conflict_do_update(
                index_elements=["symbol"],
                set_={
                    "is_active": True,
                    "last_seen_at": datetime.now(timezone.utc),
                },
            ).returning(Symbol.id)

            result = await session.execute(stmt)
            symbol_id = result.scalar_one()
            symbol_ids[sym.symbol] = symbol_id

        await session.commit()
        logger.info(f"Ensured {len(symbol_ids)} symbols in database")
        return symbol_ids

    async def _create_run(
        self, session: AsyncSession, timeframe: str
    ) -> UUID:
        """Create a new computation run record.

        Args:
            session: Database session.
            timeframe: Timeframe being computed.

        Returns:
            Run ID.
        """
        run = ComputationRun(timeframe=timeframe, status="running")
        session.add(run)
        await session.commit()
        await session.refresh(run)
        logger.info(f"Created computation run {run.id} for {timeframe}")
        return run.id

    async def _complete_run(
        self,
        session: AsyncSession,
        run_id: UUID,
        symbol_count: int,
        status: str = "completed",
        error_message: str | None = None,
    ) -> None:
        """Mark a computation run as complete.

        Args:
            session: Database session.
            run_id: Run ID to update.
            symbol_count: Number of symbols processed.
            status: Final status (completed/failed).
            error_message: Error message if failed.
        """
        result = await session.execute(
            select(ComputationRun).where(ComputationRun.id == run_id)
        )
        run = result.scalar_one()
        run.finished_at = datetime.now(timezone.utc)
        run.symbol_count = symbol_count
        run.status = status
        run.error_message = error_message
        await session.commit()
        logger.info(f"Completed run {run_id}: {status}, {symbol_count} symbols")

    async def _persist_snapshots(
        self,
        session: AsyncSession,
        snapshots: list,
        run_id: UUID,
    ) -> int:
        """Persist ranking snapshots to database.

        Args:
            session: Database session.
            snapshots: List of RankedSnapshot objects.
            run_id: Computation run ID.

        Returns:
            Number of snapshots persisted.
        """
        for snap in snapshots:
            db_snap = Snapshot(
                symbol_id=snap.symbol_id,
                timeframe=snap.timeframe,
                bullish_score=snap.bullish_score,
                confidence=snap.confidence,
                rank=snap.rank,
                highlights=snap.highlights,
                indicator_signals=snap.indicator_signals,
                computed_at=snap.computed_at,
                run_id=run_id,
            )
            session.add(db_snap)

        await session.commit()
        logger.info(f"Persisted {len(snapshots)} snapshots for run {run_id}")
        return len(snapshots)

    async def run(self, timeframe: str) -> dict:
        """Execute the full ranking pipeline for a timeframe.

        Args:
            timeframe: Timeframe to process (15m, 30m, 1h, 4h, 1d, 1w).

        Returns:
            Dict with run results.
        """
        if timeframe not in TIMEFRAME_CONFIG:
            raise ValueError(f"Invalid timeframe: {timeframe}")

        config = TIMEFRAME_CONFIG[timeframe]
        started_at = datetime.now(timezone.utc)

        async with async_session() as session:
            # Try to acquire lock
            if not await self._acquire_lock(session, timeframe):
                return {
                    "status": "skipped",
                    "reason": "Another run in progress",
                    "timeframe": timeframe,
                }

            run_id = None
            try:
                # Create run record
                run_id = await self._create_run(session, timeframe)

                # Fetch active symbols from Binance
                logger.info(f"Fetching active symbols (min volume: ${self.min_volume_usd:,.0f})")
                binance_symbols = await self.client.get_active_symbols(
                    min_volume_usd=self.min_volume_usd
                )
                logger.info(f"Found {len(binance_symbols)} active symbols")

                if not binance_symbols:
                    await self._complete_run(session, run_id, 0, "completed")
                    await self._release_lock(session, timeframe)
                    return {
                        "status": "completed",
                        "symbols": 0,
                        "timeframe": timeframe,
                        "run_id": str(run_id),
                    }

                # Ensure symbols exist in database
                symbol_ids = await self._ensure_symbols(session, binance_symbols)

                # Fetch OHLCV for all symbols
                logger.info(f"Fetching {config['interval']} candles for {len(binance_symbols)} symbols")
                symbol_names = [s.symbol for s in binance_symbols]
                ohlcv_data = await self.client.get_klines_batch(
                    symbol_names,
                    config["interval"],
                    limit=config["candles"],
                )
                logger.info(f"Fetched OHLCV for {len(ohlcv_data)} symbols")

                # Fetch funding rates (one bulk call)
                funding_rates = await self.client.get_funding_rates()

                # Compute indicators and prepare for ranking
                symbol_data_list: list[SymbolData] = []
                errors = []

                for sym in binance_symbols:
                    if sym.symbol not in ohlcv_data:
                        errors.append(f"{sym.symbol}: no OHLCV data")
                        continue

                    df = ohlcv_data[sym.symbol]
                    if len(df) < 50:  # Minimum candles for indicators
                        errors.append(f"{sym.symbol}: insufficient data ({len(df)} candles)")
                        continue

                    try:
                        indicators = self.registry.compute_all(df)

                        # Compute price/volume variation (candle-over-candle)
                        price_change_pct = None
                        volume_change_pct = None
                        if len(df) >= 2:
                            prev_close = float(df.iloc[-2]["close"])
                            curr_close = float(df.iloc[-1]["close"])
                            if prev_close != 0:
                                price_change_pct = (curr_close - prev_close) / prev_close * 100

                            prev_vol = float(df.iloc[-2]["volume"])
                            curr_vol = float(df.iloc[-1]["volume"])
                            if prev_vol != 0:
                                volume_change_pct = (curr_vol - prev_vol) / prev_vol * 100

                        symbol_data_list.append(
                            SymbolData(
                                symbol=sym.symbol,
                                symbol_id=symbol_ids[sym.symbol],
                                indicators=indicators,
                                quote_volume_24h=float(sym.quote_volume_24h or 0),
                                price_change_pct=price_change_pct,
                                volume_change_pct=volume_change_pct,
                                funding_rate=funding_rates.get(sym.symbol),
                            )
                        )
                    except Exception as e:
                        errors.append(f"{sym.symbol}: indicator error - {e}")

                if errors:
                    logger.warning(f"Errors for {len(errors)} symbols: {errors[:5]}...")

                # Rank symbols
                logger.info(f"Ranking {len(symbol_data_list)} symbols")
                snapshots = self.ranker.rank(
                    symbol_data_list,
                    timeframe=timeframe,
                    run_id=run_id,
                    computed_at=started_at,
                )

                # Persist snapshots
                persisted = await self._persist_snapshots(session, snapshots, run_id)

                # Complete run
                await self._complete_run(session, run_id, len(snapshots), "completed")

                # Extract current prices and candle data for agent orchestrator
                current_prices = {}
                candle_data = {}
                for symbol, df in ohlcv_data.items():
                    if len(df) > 0:
                        last = df.iloc[-1]
                        current_prices[symbol] = Decimal(str(last["close"]))
                        candle_data[symbol] = {
                            "high": Decimal(str(last["high"])),
                            "low": Decimal(str(last["low"])),
                            "close": Decimal(str(last["close"])),
                        }

                elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
                logger.info(
                    f"Pipeline completed: {timeframe}, {len(snapshots)} symbols, "
                    f"{elapsed:.1f}s elapsed"
                )

                return {
                    "status": "completed",
                    "timeframe": timeframe,
                    "run_id": str(run_id),
                    "symbols": len(snapshots),
                    "errors": len(errors),
                    "elapsed_seconds": elapsed,
                    "current_prices": current_prices,
                    "candle_data": candle_data,
                }

            except Exception as e:
                logger.exception(f"Pipeline failed for {timeframe}: {e}")
                # Rollback the poisoned transaction before updating run status
                await session.rollback()
                if run_id:
                    try:
                        await self._complete_run(
                            session, run_id, 0, "failed", str(e)
                        )
                    except Exception as inner:
                        logger.error(f"Failed to mark run as failed: {inner}")
                return {
                    "status": "failed",
                    "timeframe": timeframe,
                    "run_id": str(run_id) if run_id else None,
                    "error": str(e),
                }

            finally:
                try:
                    await self._release_lock(session, timeframe)
                except Exception as unlock_err:
                    logger.error(f"Failed to release lock for {timeframe}: {unlock_err}")


# Default runner instance
default_runner = PipelineRunner()
