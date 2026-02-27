"""Phase 4 — Read-only analytics aggregation endpoints.

12 GET endpoints under /analytics for dashboard charts and summary stats.
All queries use raw SQL via sqlalchemy text() for performance.
"""

from fastapi import APIRouter
from sqlalchemy import text

from src.db import async_session

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ---------------------------------------------------------------------------
# 1. GET /analytics/summary
# ---------------------------------------------------------------------------
@router.get("/summary")
async def get_summary():
    async with async_session() as session:
        main = await session.execute(text("""
            SELECT
              COALESCE(SUM(p.total_equity - a.initial_balance), 0) as total_pnl,
              COALESCE(SUM(a.initial_balance), 0) as total_initial_balance,
              COALESCE(SUM(p.total_fees_paid), 0) as total_fees,
              (SELECT COUNT(*) FROM agent_trades) as total_trades,
              (SELECT COUNT(*) FILTER (WHERE pnl > 0) FROM agent_trades) as total_wins,
              (SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM agent_token_usage) as total_token_cost,
              (SELECT COALESCE(SUM(pnl), 0) FROM agent_trades WHERE pnl > 0) as gross_wins,
              (SELECT COALESCE(ABS(SUM(pnl)), 0) FROM agent_trades WHERE pnl < 0) as gross_losses,
              (SELECT COUNT(*) FROM agents WHERE status = 'active') as active_agents
            FROM agents a
            JOIN agent_portfolios p ON a.id = p.agent_id
        """))
        row = main.mappings().first()

        dd = await session.execute(text("""
            SELECT MIN(
              CASE WHEN a.initial_balance > 0
                THEN ((p.total_equity - a.initial_balance) / a.initial_balance) * 100
                ELSE 0
              END
            ) as max_drawdown_pct
            FROM agents a
            JOIN agent_portfolios p ON a.id = p.agent_id
        """))
        dd_row = dd.mappings().first()

    if not row:
        return {
            "totalPnl": 0.0,
            "totalTrades": 0,
            "totalWins": 0,
            "totalFees": 0.0,
            "totalTokenCost": 0.0,
            "totalInitialBalance": 0.0,
            "maxDrawdownPct": 0.0,
            "grossWins": 0.0,
            "grossLosses": 0.0,
            "activeAgents": 0,
        }

    max_dd = float(dd_row["max_drawdown_pct"] or 0) if dd_row else 0.0
    if max_dd > 0:
        max_dd = 0.0  # clamp to <= 0

    return {
        "totalPnl": float(row["total_pnl"]),
        "totalTrades": int(row["total_trades"]),
        "totalWins": int(row["total_wins"]),
        "totalFees": float(row["total_fees"]),
        "totalTokenCost": float(row["total_token_cost"]),
        "totalInitialBalance": float(row["total_initial_balance"]),
        "maxDrawdownPct": max_dd,
        "grossWins": float(row["gross_wins"]),
        "grossLosses": float(row["gross_losses"]),
        "activeAgents": int(row["active_agents"]),
    }


# ---------------------------------------------------------------------------
# Helper: shared grouping query for archetypes / sources / timeframes
# ---------------------------------------------------------------------------
_GROUP_QUERY_TEMPLATE = """
    SELECT {group_col} as group_key,
      COUNT(DISTINCT a.id) as agent_count,
      COALESCE(SUM(p.total_equity - a.initial_balance), 0) as total_pnl,
      COALESCE(SUM(sub.trade_count), 0) as trade_count,
      COALESCE(SUM(sub.wins), 0) as wins,
      COALESCE(SUM(sub.gross_wins), 0) as gross_wins,
      COALESCE(SUM(sub.gross_losses), 0) as gross_losses,
      CASE WHEN COALESCE(SUM(sub.trade_count), 0) > 0
        THEN SUM(sub.avg_duration * sub.trade_count) / SUM(sub.trade_count)
        ELSE 0
      END as avg_duration_minutes
    FROM agents a
    JOIN agent_portfolios p ON a.id = p.agent_id
    LEFT JOIN (
      SELECT agent_id,
        COUNT(*) as trade_count,
        COUNT(*) FILTER (WHERE pnl > 0) as wins,
        COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) as gross_wins,
        COALESCE(ABS(SUM(pnl) FILTER (WHERE pnl < 0)), 0) as gross_losses,
        AVG(duration_minutes) as avg_duration
      FROM agent_trades
      GROUP BY agent_id
    ) sub ON sub.agent_id = a.id
    GROUP BY {group_col}
    ORDER BY total_pnl DESC
"""


async def _grouped_stats(group_col: str, key_name: str):
    sql = _GROUP_QUERY_TEMPLATE.format(group_col=group_col)
    async with async_session() as session:
        result = await session.execute(text(sql))
        rows = result.mappings().all()

    out = []
    for r in rows:
        tc = int(r["trade_count"])
        wins = int(r["wins"])
        out.append({
            key_name: r["group_key"],
            "agentCount": int(r["agent_count"]),
            "totalPnl": float(r["total_pnl"]),
            "tradeCount": tc,
            "wins": wins,
            "winRate": round(wins / tc, 4) if tc > 0 else 0.0,
            "grossWins": float(r["gross_wins"]),
            "grossLosses": float(r["gross_losses"]),
            "avgDurationMinutes": float(r["avg_duration_minutes"]),
        })
    return out


# ---------------------------------------------------------------------------
# 2. GET /analytics/archetypes
# ---------------------------------------------------------------------------
@router.get("/archetypes")
async def get_archetypes():
    return await _grouped_stats("a.strategy_archetype", "archetype")


# ---------------------------------------------------------------------------
# 3. GET /analytics/sources
# ---------------------------------------------------------------------------
@router.get("/sources")
async def get_sources():
    return await _grouped_stats("a.source", "source")


# ---------------------------------------------------------------------------
# 4. GET /analytics/timeframes
# ---------------------------------------------------------------------------
@router.get("/timeframes")
async def get_timeframes():
    return await _grouped_stats("a.timeframe", "timeframe")


# ---------------------------------------------------------------------------
# 5. GET /analytics/daily-pnl
# ---------------------------------------------------------------------------
@router.get("/daily-pnl")
async def get_daily_pnl():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT DATE(closed_at) as day,
              SUM(pnl) as daily_pnl,
              COUNT(*) as trade_count,
              COUNT(*) FILTER (WHERE pnl > 0) as wins
            FROM agent_trades
            WHERE closed_at >= NOW() - INTERVAL '90 days'
            GROUP BY DATE(closed_at)
            ORDER BY day ASC
        """))
        rows = result.mappings().all()

    cumulative = 0.0
    out = []
    for r in rows:
        daily = float(r["daily_pnl"])
        cumulative += daily
        out.append({
            "day": r["day"].isoformat().split("T")[0],
            "dailyPnl": daily,
            "cumulativePnl": round(cumulative, 6),
            "tradeCount": int(r["trade_count"]),
            "wins": int(r["wins"]),
        })
    return out


# ---------------------------------------------------------------------------
# 6. GET /analytics/daily-archetype-pnl
# ---------------------------------------------------------------------------
@router.get("/daily-archetype-pnl")
async def get_daily_archetype_pnl():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT DATE(t.closed_at) as day,
              a.strategy_archetype,
              SUM(t.pnl) as daily_pnl
            FROM agent_trades t
            JOIN agents a ON a.id = t.agent_id
            WHERE t.closed_at >= NOW() - INTERVAL '90 days'
            GROUP BY DATE(t.closed_at), a.strategy_archetype
            ORDER BY day ASC, a.strategy_archetype
        """))
        rows = result.mappings().all()

    return [
        {
            "day": r["day"].isoformat().split("T")[0],
            "archetype": r["strategy_archetype"],
            "dailyPnl": float(r["daily_pnl"]),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 7. GET /analytics/symbols
# ---------------------------------------------------------------------------
@router.get("/symbols")
async def get_symbols():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT sym.symbol,
              COUNT(*) as trade_count,
              COUNT(*) FILTER (WHERE t.pnl > 0) as wins,
              SUM(t.pnl) as total_pnl,
              AVG(t.pnl) as avg_pnl,
              SUM(t.fees) as total_fees,
              COALESCE(SUM(t.pnl) FILTER (WHERE t.pnl > 0), 0) as gross_wins,
              COALESCE(ABS(SUM(t.pnl) FILTER (WHERE t.pnl < 0)), 0) as gross_losses,
              AVG(t.duration_minutes) as avg_duration_minutes,
              COUNT(*) FILTER (WHERE t.direction = 'long') as long_count,
              COUNT(*) FILTER (WHERE t.direction = 'short') as short_count
            FROM agent_trades t
            JOIN symbols sym ON sym.id = t.symbol_id
            GROUP BY sym.symbol
            ORDER BY COUNT(*) DESC
            LIMIT 30
        """))
        rows = result.mappings().all()

    out = []
    for r in rows:
        tc = int(r["trade_count"])
        wins = int(r["wins"])
        out.append({
            "symbol": r["symbol"],
            "tradeCount": tc,
            "wins": wins,
            "winRate": round(wins / tc, 4) if tc > 0 else 0.0,
            "totalPnl": float(r["total_pnl"]),
            "avgPnl": float(r["avg_pnl"]),
            "totalFees": float(r["total_fees"]),
            "grossWins": float(r["gross_wins"]),
            "grossLosses": float(r["gross_losses"]),
            "avgDurationMinutes": float(r["avg_duration_minutes"]),
            "longCount": int(r["long_count"]),
            "shortCount": int(r["short_count"]),
        })
    return out


# ---------------------------------------------------------------------------
# 8. GET /analytics/daily-token-cost
# ---------------------------------------------------------------------------
@router.get("/daily-token-cost")
async def get_daily_token_cost():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT date as day,
              SUM(estimated_cost_usd) as daily_cost,
              SUM(input_tokens) as input_tokens,
              SUM(output_tokens) as output_tokens
            FROM agent_token_usage
            WHERE date >= NOW() - INTERVAL '90 days'
            GROUP BY date
            ORDER BY day ASC
        """))
        rows = result.mappings().all()

    return [
        {
            "day": r["day"].isoformat().split("T")[0],
            "dailyCost": float(r["daily_cost"]),
            "inputTokens": int(r["input_tokens"]),
            "outputTokens": int(r["output_tokens"]),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 9. GET /analytics/model-costs
# ---------------------------------------------------------------------------
@router.get("/model-costs")
async def get_model_costs():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT model,
              task_type,
              SUM(input_tokens) as input_tokens,
              SUM(output_tokens) as output_tokens,
              SUM(estimated_cost_usd) as total_cost
            FROM agent_token_usage
            GROUP BY model, task_type
            ORDER BY total_cost DESC
        """))
        rows = result.mappings().all()

    return [
        {
            "model": r["model"],
            "taskType": r["task_type"],
            "inputTokens": int(r["input_tokens"]),
            "outputTokens": int(r["output_tokens"]),
            "totalCost": float(r["total_cost"]),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 10. GET /analytics/archetype-costs
# ---------------------------------------------------------------------------
@router.get("/archetype-costs")
async def get_archetype_costs():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT a.strategy_archetype,
              COALESCE(SUM(tu.estimated_cost_usd), 0) as total_cost,
              COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
              COALESCE(SUM(trades.trade_count), 0) as trade_count,
              COALESCE(SUM(trades.total_pnl), 0) as total_pnl
            FROM agents a
            LEFT JOIN agent_token_usage tu ON tu.agent_id = a.id
            LEFT JOIN (
              SELECT agent_id,
                COUNT(*) as trade_count,
                SUM(pnl) as total_pnl
              FROM agent_trades
              GROUP BY agent_id
            ) trades ON trades.agent_id = a.id
            GROUP BY a.strategy_archetype
            ORDER BY total_cost DESC
        """))
        rows = result.mappings().all()

    out = []
    for r in rows:
        cost = float(r["total_cost"])
        pnl = float(r["total_pnl"])
        out.append({
            "archetype": r["strategy_archetype"],
            "totalCost": cost,
            "totalTokens": int(r["total_tokens"]),
            "tradeCount": int(r["trade_count"]),
            "totalPnl": pnl,
            "roi": round(pnl / cost, 2) if cost > 0 else 0.0,
        })
    return out


# ---------------------------------------------------------------------------
# 11. GET /analytics/directions
# ---------------------------------------------------------------------------
@router.get("/directions")
async def get_directions():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT direction,
              COUNT(*) as trade_count,
              COUNT(*) FILTER (WHERE pnl > 0) as wins,
              COALESCE(SUM(pnl), 0) as total_pnl,
              COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) as gross_wins,
              COALESCE(ABS(SUM(pnl) FILTER (WHERE pnl < 0)), 0) as gross_losses,
              AVG(duration_minutes) as avg_duration_minutes
            FROM agent_trades
            GROUP BY direction
        """))
        rows = result.mappings().all()

    out = []
    for r in rows:
        tc = int(r["trade_count"])
        wins = int(r["wins"])
        out.append({
            "direction": r["direction"],
            "tradeCount": tc,
            "wins": wins,
            "winRate": round(wins / tc, 4) if tc > 0 else 0.0,
            "totalPnl": float(r["total_pnl"]),
            "grossWins": float(r["gross_wins"]),
            "grossLosses": float(r["gross_losses"]),
            "avgDurationMinutes": float(r["avg_duration_minutes"]),
        })
    return out


# ---------------------------------------------------------------------------
# 12. GET /analytics/drawdowns
# ---------------------------------------------------------------------------
@router.get("/drawdowns")
async def get_drawdowns():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT a.id,
              a.display_name,
              a.strategy_archetype,
              a.timeframe,
              GREATEST(p.peak_equity, a.initial_balance) as peak_equity,
              p.total_equity,
              CASE WHEN GREATEST(p.peak_equity, a.initial_balance) > 0
                THEN ((p.total_equity - GREATEST(p.peak_equity, a.initial_balance))
                      / GREATEST(p.peak_equity, a.initial_balance)) * 100
                ELSE 0
              END as drawdown_pct
            FROM agents a
            JOIN agent_portfolios p ON a.id = p.agent_id
            WHERE p.total_equity < GREATEST(p.peak_equity, a.initial_balance)
            ORDER BY drawdown_pct ASC
        """))
        rows = result.mappings().all()

    return [
        {
            "id": str(r["id"]),
            "displayName": r["display_name"],
            "archetype": r["strategy_archetype"],
            "timeframe": r["timeframe"],
            "peakEquity": float(r["peak_equity"]),
            "totalEquity": float(r["total_equity"]),
            "drawdownPct": float(r["drawdown_pct"]),
        }
        for r in rows
    ]
