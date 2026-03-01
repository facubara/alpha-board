"""Trades API endpoints.

GET /trades/recent?limit=50 — Recent closed trades + open positions (merged, sorted)
"""

import asyncio
import logging
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Query
from sqlalchemy import text

from src.db import async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trades", tags=["trades"])


CLOSED_TRADES_SQL = text("""
    WITH agent_ranks AS (
        SELECT a.id, ROW_NUMBER() OVER (ORDER BY (p.total_equity - a.initial_balance) DESC) as rank
        FROM agents a
        JOIN agent_portfolios p ON a.id = p.agent_id
        WHERE a.status != 'discarded'
    )
    SELECT
        t.id,
        a.display_name as agent_name,
        a.id as agent_id,
        COALESCE(a.uuid::text, '') as agent_uuid,
        a.engine,
        sym.symbol,
        t.direction,
        t.entry_price,
        t.exit_price,
        t.position_size,
        t.pnl,
        CASE WHEN t.position_size > 0 THEN (t.pnl / t.position_size * 100) ELSE 0 END as pnl_pct,
        t.exit_reason,
        t.duration_minutes,
        t.closed_at as timestamp,
        COALESCE(cd.reasoning_summary, od.reasoning_summary) as reasoning_summary,
        ar.rank as leaderboard_rank
    FROM agent_trades t
    JOIN agents a ON a.id = t.agent_id
    JOIN symbols sym ON sym.id = t.symbol_id
    LEFT JOIN agent_decisions cd ON cd.id = t.close_decision_id
    LEFT JOIN agent_decisions od ON od.id = t.decision_id
    LEFT JOIN agent_ranks ar ON ar.id = a.id
    ORDER BY t.closed_at DESC
    LIMIT :limit
""")

OPEN_POSITIONS_SQL = text("""
    WITH agent_ranks AS (
        SELECT a.id, ROW_NUMBER() OVER (ORDER BY (p.total_equity - a.initial_balance) DESC) as rank
        FROM agents a
        JOIN agent_portfolios p ON a.id = p.agent_id
        WHERE a.status != 'discarded'
    )
    SELECT
        pos.id,
        a.display_name as agent_name,
        a.id as agent_id,
        COALESCE(a.uuid::text, '') as agent_uuid,
        a.engine,
        sym.symbol,
        pos.direction,
        pos.entry_price,
        pos.position_size,
        pos.stop_loss,
        pos.take_profit,
        pos.opened_at as timestamp,
        ar.rank as leaderboard_rank
    FROM agent_positions pos
    JOIN agents a ON a.id = pos.agent_id
    JOIN symbols sym ON sym.id = pos.symbol_id
    LEFT JOIN agent_ranks ar ON ar.id = a.id
    ORDER BY pos.opened_at DESC
""")


def _to_float(val: Decimal | float | int | None) -> float | None:
    """Convert a Decimal/numeric value to float, or None."""
    if val is None:
        return None
    return float(val)


def _map_closed_row(row) -> dict:
    """Map a closed trade row to a TradeNotification dict (camelCase keys)."""
    return {
        "id": f"closed-{row.id}",
        "type": "trade_closed",
        "agentName": row.agent_name,
        "agentId": row.agent_id,
        "agentUuid": row.agent_uuid or "",
        "engine": row.engine or "llm",
        "symbol": row.symbol,
        "direction": row.direction,
        "entryPrice": _to_float(row.entry_price),
        "exitPrice": _to_float(row.exit_price),
        "positionSize": _to_float(row.position_size),
        "pnl": _to_float(row.pnl),
        "pnlPct": _to_float(row.pnl_pct),
        "exitReason": row.exit_reason,
        "durationMinutes": row.duration_minutes,
        "stopLoss": None,
        "takeProfit": None,
        "confidence": None,
        "reasoningSummary": row.reasoning_summary or None,
        "leaderboardRank": int(row.leaderboard_rank) if row.leaderboard_rank else None,
        "timestamp": row.timestamp.isoformat() if isinstance(row.timestamp, datetime) else str(row.timestamp),
        "isRead": True,
    }


def _map_open_row(row) -> dict:
    """Map an open position row to a TradeNotification dict (camelCase keys)."""
    return {
        "id": f"open-{row.id}",
        "type": "trade_opened",
        "agentName": row.agent_name,
        "agentId": row.agent_id,
        "agentUuid": row.agent_uuid or "",
        "engine": row.engine or "llm",
        "symbol": row.symbol,
        "direction": row.direction,
        "entryPrice": _to_float(row.entry_price),
        "exitPrice": None,
        "positionSize": _to_float(row.position_size),
        "pnl": None,
        "pnlPct": None,
        "exitReason": None,
        "durationMinutes": None,
        "stopLoss": _to_float(row.stop_loss),
        "takeProfit": _to_float(row.take_profit),
        "confidence": None,
        "reasoningSummary": None,
        "leaderboardRank": int(row.leaderboard_rank) if row.leaderboard_rank else None,
        "timestamp": row.timestamp.isoformat() if isinstance(row.timestamp, datetime) else str(row.timestamp),
        "isRead": True,
    }


@router.get("/recent")
async def get_recent_trades(limit: int = Query(default=50, ge=1, le=500)):
    """Recent closed trades + open positions, merged and sorted by timestamp descending.

    Replicates the frontend getRecentTrades() query from web/src/lib/queries/trades.ts.
    """
    async with async_session() as session:
        closed_result = await session.execute(CLOSED_TRADES_SQL, {"limit": limit})
        open_result = await session.execute(OPEN_POSITIONS_SQL)

        closed = [_map_closed_row(row) for row in closed_result]
        opened = [_map_open_row(row) for row in open_result]

    # Merge and sort by timestamp descending
    merged = opened + closed
    merged.sort(key=lambda x: x["timestamp"], reverse=True)

    return merged
