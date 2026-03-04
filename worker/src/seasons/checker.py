"""Season checker — auto-advance per-timeframe seasons.

Runs every 5 minutes via APScheduler. Detects expired seasons and
performs the full transition: snapshot → close positions → reset → advance.
"""

import logging
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import async_session
from src.models.db import Agent, TimeframeSeason

logger = logging.getLogger(__name__)

# Season durations per timeframe
SEASON_DURATIONS: dict[str, relativedelta] = {
    "15m": relativedelta(weeks=1),
    "30m": relativedelta(weeks=2),
    "1h": relativedelta(months=1),
    "4h": relativedelta(months=3),
    "1d": relativedelta(months=6),
}


async def check_and_advance_seasons() -> None:
    """Check all timeframes for expired seasons and advance them."""
    async with async_session() as session:
        # Find expired seasons with advisory lock to prevent double-fire
        result = await session.execute(
            text("""
                SELECT timeframe, current_season, season_start, season_end
                FROM timeframe_seasons
                WHERE season_end <= NOW() AND status = 'active'
                FOR UPDATE SKIP LOCKED
            """)
        )
        expired = result.fetchall()

        if not expired:
            return

        for row in expired:
            tf = row.timeframe
            season_num = row.current_season
            logger.info(f"Season {season_num} expired for {tf} — starting transition")

            try:
                await _transition_season(session, tf, season_num)
                await session.commit()
                logger.info(f"Season {season_num} → {season_num + 1} for {tf} completed")
            except Exception:
                await session.rollback()
                logger.exception(f"Failed to transition season for {tf}")


async def _transition_season(
    session: AsyncSession, timeframe: str, season_num: int
) -> None:
    """Execute the full season transition for a single timeframe."""
    now = datetime.now(timezone.utc)

    # Mark as transitioning
    await session.execute(
        text("""
            UPDATE timeframe_seasons
            SET status = 'transitioning', updated_at = :now
            WHERE timeframe = :tf
        """),
        {"tf": timeframe, "now": now},
    )

    # Get all non-discarded agents in this timeframe
    agents_result = await session.execute(
        select(Agent).where(
            Agent.timeframe == timeframe,
            Agent.status != "discarded",
        )
    )
    agents = list(agents_result.scalars().all())
    agent_ids = [a.id for a in agents]

    if not agent_ids:
        # No agents — just advance the season
        await _advance_season_row(session, timeframe, season_num, now)
        return

    # 1. Snapshot portfolios
    await _snapshot_portfolios(session, timeframe, season_num, agent_ids)

    # 2. Force-close open positions
    await _force_close_positions(session, timeframe, season_num, agent_ids, now)

    # 3. Reset portfolios to $10k for active agents
    active_ids = [a.id for a in agents if a.status == "active"]
    if active_ids:
        await _reset_portfolios(session, active_ids, now)

    # 4. Advance season row
    await _advance_season_row(session, timeframe, season_num, now)


async def _snapshot_portfolios(
    session: AsyncSession,
    timeframe: str,
    season_num: int,
    agent_ids: list[int],
) -> None:
    """Archive current portfolio state into agent_season_snapshots."""
    placeholders = ", ".join(f":id_{i}" for i in range(len(agent_ids)))
    params = {f"id_{i}": aid for i, aid in enumerate(agent_ids)}
    params["season"] = season_num
    params["tf"] = timeframe

    await session.execute(
        text(f"""
            INSERT INTO agent_season_snapshots
                (timeframe, season, agent_id, agent_name, cash_balance, total_equity,
                 total_realized_pnl, total_fees_paid, peak_equity, trough_equity,
                 trade_count, win_count, win_rate)
            SELECT
                :tf,
                :season,
                a.id,
                a.name,
                p.cash_balance,
                p.total_equity,
                p.total_realized_pnl,
                p.total_fees_paid,
                p.peak_equity,
                p.trough_equity,
                COALESCE(ts.trade_count, 0),
                COALESCE(ts.win_count, 0),
                CASE
                    WHEN COALESCE(ts.trade_count, 0) = 0 THEN 0.00
                    ELSE ROUND(COALESCE(ts.win_count, 0)::numeric / ts.trade_count * 100, 2)
                END
            FROM agents a
            JOIN agent_portfolios p ON p.agent_id = a.id
            LEFT JOIN (
                SELECT
                    agent_id,
                    COUNT(*) AS trade_count,
                    COUNT(*) FILTER (WHERE pnl > 0) AS win_count
                FROM agent_trades
                WHERE season = :season
                GROUP BY agent_id
            ) ts ON ts.agent_id = a.id
            WHERE a.id IN ({placeholders})
        """),
        params,
    )


async def _force_close_positions(
    session: AsyncSession,
    timeframe: str,
    season_num: int,
    agent_ids: list[int],
    now: datetime,
) -> None:
    """Force-close all open positions for agents in the timeframe."""
    placeholders = ", ".join(f":id_{i}" for i in range(len(agent_ids)))
    params = {f"id_{i}": aid for i, aid in enumerate(agent_ids)}
    params["season"] = season_num
    params["now"] = now

    # Insert trade records for open positions
    await session.execute(
        text(f"""
            INSERT INTO agent_trades
                (agent_id, symbol_id, direction, entry_price, exit_price,
                 position_size, pnl, fees, exit_reason, opened_at, closed_at,
                 duration_minutes, season)
            SELECT
                agent_id,
                symbol_id,
                direction,
                entry_price,
                entry_price,
                position_size,
                unrealized_pnl,
                0.00,
                'season_reset',
                opened_at,
                :now,
                EXTRACT(EPOCH FROM (:now - opened_at))::int / 60,
                :season
            FROM agent_positions
            WHERE agent_id IN ({placeholders})
        """),
        params,
    )

    # Delete closed positions
    await session.execute(
        text(f"""
            DELETE FROM agent_positions
            WHERE agent_id IN ({placeholders})
        """),
        {f"id_{i}": aid for i, aid in enumerate(agent_ids)},
    )


async def _reset_portfolios(
    session: AsyncSession, agent_ids: list[int], now: datetime
) -> None:
    """Reset portfolios to $10k for active agents."""
    placeholders = ", ".join(f":id_{i}" for i in range(len(agent_ids)))
    params = {f"id_{i}": aid for i, aid in enumerate(agent_ids)}
    params["now"] = now

    await session.execute(
        text(f"""
            UPDATE agent_portfolios SET
                cash_balance = 10000.00,
                total_equity = 10000.00,
                total_realized_pnl = 0.00,
                total_fees_paid = 0.00,
                peak_equity = 10000.00,
                trough_equity = 10000.00,
                updated_at = :now
            WHERE agent_id IN ({placeholders})
        """),
        params,
    )


async def _advance_season_row(
    session: AsyncSession, timeframe: str, season_num: int, now: datetime
) -> None:
    """Increment season, compute new end date, set status back to active."""
    duration = SEASON_DURATIONS[timeframe]
    new_end = now + duration

    await session.execute(
        text("""
            UPDATE timeframe_seasons SET
                current_season = :new_season,
                season_start = :now,
                season_end = :new_end,
                status = 'active',
                updated_at = :now
            WHERE timeframe = :tf
        """),
        {
            "tf": timeframe,
            "new_season": season_num + 1,
            "now": now,
            "new_end": new_end,
        },
    )
