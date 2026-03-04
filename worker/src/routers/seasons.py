"""Seasons router — per-timeframe season status and history."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from src.db import async_session

router = APIRouter(prefix="/seasons", tags=["seasons"])


def _safe_float(val) -> float | None:
    """Convert a Decimal/numeric value to float, returning None for NULL."""
    if val is None:
        return None
    return float(val)


@router.get("")
async def get_all_seasons():
    """Get current season state for all timeframes."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT
                    ts.timeframe,
                    ts.current_season,
                    ts.season_start,
                    ts.season_end,
                    ts.status,
                    -- trade count for current season in this timeframe
                    COALESCE(tc.trade_count, 0) AS trade_count,
                    -- agent count (non-discarded in this timeframe)
                    COALESCE(ac.agent_count, 0) AS agent_count,
                    -- top agent by PnL
                    top.agent_id AS top_agent_id,
                    top.display_name AS top_agent_display_name,
                    top.total_realized_pnl AS top_agent_pnl
                FROM timeframe_seasons ts
                LEFT JOIN (
                    SELECT
                        a.timeframe,
                        COUNT(*) AS trade_count
                    FROM agent_trades t
                    JOIN agents a ON a.id = t.agent_id
                    JOIN timeframe_seasons ts2 ON ts2.timeframe = a.timeframe
                    WHERE t.season = ts2.current_season
                    GROUP BY a.timeframe
                ) tc ON tc.timeframe = ts.timeframe
                LEFT JOIN (
                    SELECT
                        timeframe,
                        COUNT(*) AS agent_count
                    FROM agents
                    WHERE status != 'discarded'
                      AND timeframe != 'cross'
                    GROUP BY timeframe
                ) ac ON ac.timeframe = ts.timeframe
                LEFT JOIN LATERAL (
                    SELECT
                        a.id AS agent_id,
                        a.display_name,
                        p.total_realized_pnl
                    FROM agents a
                    JOIN agent_portfolios p ON p.agent_id = a.id
                    WHERE a.timeframe = ts.timeframe
                      AND a.status = 'active'
                    ORDER BY p.total_realized_pnl DESC
                    LIMIT 1
                ) top ON true
                ORDER BY
                    CASE ts.timeframe
                        WHEN '15m' THEN 1
                        WHEN '30m' THEN 2
                        WHEN '1h' THEN 3
                        WHEN '4h' THEN 4
                        WHEN '1d' THEN 5
                    END
            """)
        )
        rows = result.fetchall()

    now = datetime.now(timezone.utc)
    seasons = []
    for row in rows:
        total_duration = (row.season_end - row.season_start).total_seconds()
        elapsed = (now - row.season_start).total_seconds()
        progress_pct = min(100.0, max(0.0, (elapsed / total_duration * 100) if total_duration > 0 else 0))
        days_remaining = max(0, (row.season_end - now).total_seconds() / 86400)

        top_agent = None
        if row.top_agent_id is not None:
            top_agent = {
                "id": row.top_agent_id,
                "displayName": row.top_agent_display_name,
                "pnl": _safe_float(row.top_agent_pnl),
            }

        seasons.append({
            "timeframe": row.timeframe,
            "currentSeason": row.current_season,
            "seasonStart": row.season_start.isoformat(),
            "seasonEnd": row.season_end.isoformat(),
            "status": row.status,
            "progressPct": round(progress_pct, 1),
            "daysRemaining": round(days_remaining, 1),
            "tradeCount": row.trade_count,
            "agentCount": row.agent_count,
            "topAgent": top_agent,
        })

    return seasons


@router.get("/{timeframe}/history")
async def get_season_history(timeframe: str):
    """Get past season snapshots for a specific timeframe."""
    valid_timeframes = {"15m", "30m", "1h", "4h", "1d"}
    if timeframe not in valid_timeframes:
        raise HTTPException(status_code=400, detail=f"Invalid timeframe: {timeframe}")

    async with async_session() as session:
        # Get current season
        ts_result = await session.execute(
            text("SELECT current_season FROM timeframe_seasons WHERE timeframe = :tf"),
            {"tf": timeframe},
        )
        ts_row = ts_result.fetchone()
        if not ts_row:
            raise HTTPException(status_code=404, detail=f"No season data for {timeframe}")

        current_season = ts_row.current_season

        # Get all snapshots for this timeframe
        result = await session.execute(
            text("""
                SELECT
                    s.season,
                    s.agent_id,
                    s.agent_name,
                    a.display_name,
                    s.total_equity,
                    s.total_realized_pnl,
                    s.trade_count,
                    s.win_count,
                    s.win_rate,
                    s.peak_equity,
                    s.trough_equity,
                    s.total_fees_paid,
                    s.cash_balance,
                    s.created_at
                FROM agent_season_snapshots s
                LEFT JOIN agents a ON a.id = s.agent_id
                WHERE s.timeframe = :tf
                ORDER BY s.season DESC, s.total_realized_pnl DESC
            """),
            {"tf": timeframe},
        )
        rows = result.fetchall()

    # Group by season
    seasons_map: dict[int, dict] = {}
    for row in rows:
        season_num = row.season
        if season_num not in seasons_map:
            seasons_map[season_num] = {
                "season": season_num,
                "createdAt": row.created_at.isoformat(),
                "agents": [],
            }

        seasons_map[season_num]["agents"].append({
            "agentId": row.agent_id,
            "agentName": row.agent_name,
            "displayName": row.display_name or row.agent_name,
            "totalEquity": _safe_float(row.total_equity),
            "totalRealizedPnl": _safe_float(row.total_realized_pnl),
            "tradeCount": row.trade_count,
            "winRate": _safe_float(row.win_rate),
            "peakEquity": _safe_float(row.peak_equity),
            "troughEquity": _safe_float(row.trough_equity),
            "totalFeesPaid": _safe_float(row.total_fees_paid),
            "cashBalance": _safe_float(row.cash_balance),
        })

    return {
        "timeframe": timeframe,
        "currentSeason": current_season,
        "history": list(seasons_map.values()),
    }
