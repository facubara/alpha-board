"""Phase 4 — Read-only analytics aggregation endpoints.

12 GET endpoints under /analytics for dashboard charts and summary stats.
All queries use raw SQL via sqlalchemy text() for performance.
Worker-side Redis caching with 120s TTL on all endpoints.
"""

import json
from typing import Any

from fastapi import APIRouter
from sqlalchemy import text

from src.cache import cache_get, cache_set
from src.db import async_session

router = APIRouter(prefix="/analytics", tags=["analytics"])

ANALYTICS_TTL = 120  # seconds


async def _cached(key: str, fn) -> Any:
    """Cache-through wrapper. Returns cached JSON or computes + caches."""
    hit = await cache_get(f"analytics:{key}")
    if hit is not None:
        return json.loads(hit)
    result = await fn()
    await cache_set(f"analytics:{key}", json.dumps(result, default=str), ANALYTICS_TTL)
    return result


# ---------------------------------------------------------------------------
# Compute functions (accept optional session for /all consolidation)
# ---------------------------------------------------------------------------

async def _compute_summary(session=None):
    async def _run(s):
        # Single query for agents + portfolios + drawdown
        main = await s.execute(text("""
            SELECT
              COALESCE(SUM(p.total_equity - a.initial_balance), 0) as total_pnl,
              COALESCE(SUM(a.initial_balance), 0) as total_initial_balance,
              COALESCE(SUM(p.total_fees_paid), 0) as total_fees,
              COUNT(*) FILTER (WHERE a.status = 'active') as active_agents,
              MIN(CASE WHEN a.initial_balance > 0
                THEN ((p.total_equity - a.initial_balance) / a.initial_balance) * 100
                ELSE 0 END) as max_drawdown_pct
            FROM agents a
            JOIN agent_portfolios p ON a.id = p.agent_id
        """))
        row = main.mappings().first()

        # Single trades scan
        trades = await s.execute(text("""
            SELECT COUNT(*) as total_trades,
              COUNT(*) FILTER (WHERE pnl > 0) as total_wins,
              COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) as gross_wins,
              COALESCE(ABS(SUM(pnl) FILTER (WHERE pnl < 0)), 0) as gross_losses
            FROM agent_trades
        """))
        t_row = trades.mappings().first()

        # Single token_usage scan
        costs = await s.execute(text("""
            SELECT COALESCE(SUM(estimated_cost_usd), 0) as total_token_cost
            FROM agent_token_usage
        """))
        c_row = costs.mappings().first()

        if not row:
            return {
                "totalPnl": 0.0, "totalTrades": 0, "totalWins": 0,
                "totalFees": 0.0, "totalTokenCost": 0.0, "totalInitialBalance": 0.0,
                "maxDrawdownPct": 0.0, "grossWins": 0.0, "grossLosses": 0.0,
                "activeAgents": 0,
            }

        max_dd = float(row["max_drawdown_pct"] or 0)
        if max_dd > 0:
            max_dd = 0.0

        return {
            "totalPnl": float(row["total_pnl"]),
            "totalTrades": int(t_row["total_trades"]),
            "totalWins": int(t_row["total_wins"]),
            "totalFees": float(row["total_fees"]),
            "totalTokenCost": float(c_row["total_token_cost"]),
            "totalInitialBalance": float(row["total_initial_balance"]),
            "maxDrawdownPct": max_dd,
            "grossWins": float(t_row["gross_wins"]),
            "grossLosses": float(t_row["gross_losses"]),
            "activeAgents": int(row["active_agents"]),
        }

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


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
      WHERE closed_at >= NOW() - INTERVAL '90 days'
      GROUP BY agent_id
    ) sub ON sub.agent_id = a.id
    GROUP BY {group_col}
    ORDER BY total_pnl DESC
"""


def _format_grouped_rows(rows, key_name: str) -> list[dict]:
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


async def _compute_grouped(group_col: str, key_name: str, session=None):
    sql = _GROUP_QUERY_TEMPLATE.format(group_col=group_col)

    async def _run(s):
        result = await s.execute(text(sql))
        return _format_grouped_rows(result.mappings().all(), key_name)

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


async def _compute_archetypes(session=None):
    return await _compute_grouped("a.strategy_archetype", "archetype", session)


async def _compute_sources(session=None):
    return await _compute_grouped("a.source", "source", session)


async def _compute_timeframes(session=None):
    return await _compute_grouped("a.timeframe", "timeframe", session)


async def _compute_daily_pnl(session=None):
    async def _run(s):
        result = await s.execute(text("""
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

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


async def _compute_daily_archetype_pnl(session=None):
    async def _run(s):
        result = await s.execute(text("""
            SELECT DATE(t.closed_at) as day,
              a.strategy_archetype,
              SUM(t.pnl) as daily_pnl
            FROM agent_trades t
            JOIN agents a ON a.id = t.agent_id
            WHERE t.closed_at >= NOW() - INTERVAL '90 days'
            GROUP BY DATE(t.closed_at), a.strategy_archetype
            ORDER BY day ASC, a.strategy_archetype
        """))
        return [
            {
                "day": r["day"].isoformat().split("T")[0],
                "archetype": r["strategy_archetype"],
                "dailyPnl": float(r["daily_pnl"]),
            }
            for r in result.mappings().all()
        ]

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


async def _compute_symbols(session=None):
    async def _run(s):
        result = await s.execute(text("""
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
            WHERE t.closed_at >= NOW() - INTERVAL '90 days'
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

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


async def _compute_daily_token_cost(session=None):
    async def _run(s):
        result = await s.execute(text("""
            SELECT date as day,
              SUM(estimated_cost_usd) as daily_cost,
              SUM(input_tokens) as input_tokens,
              SUM(output_tokens) as output_tokens
            FROM agent_token_usage
            WHERE date >= NOW() - INTERVAL '90 days'
            GROUP BY date
            ORDER BY day ASC
        """))
        return [
            {
                "day": r["day"].isoformat().split("T")[0],
                "dailyCost": float(r["daily_cost"]),
                "inputTokens": int(r["input_tokens"]),
                "outputTokens": int(r["output_tokens"]),
            }
            for r in result.mappings().all()
        ]

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


async def _compute_model_costs(session=None):
    async def _run(s):
        result = await s.execute(text("""
            SELECT model,
              task_type,
              SUM(input_tokens) as input_tokens,
              SUM(output_tokens) as output_tokens,
              SUM(estimated_cost_usd) as total_cost
            FROM agent_token_usage
            WHERE date >= NOW() - INTERVAL '90 days'
            GROUP BY model, task_type
            ORDER BY total_cost DESC
        """))
        return [
            {
                "model": r["model"],
                "taskType": r["task_type"],
                "inputTokens": int(r["input_tokens"]),
                "outputTokens": int(r["output_tokens"]),
                "totalCost": float(r["total_cost"]),
            }
            for r in result.mappings().all()
        ]

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


async def _compute_archetype_costs(session=None):
    async def _run(s):
        result = await s.execute(text("""
            SELECT a.strategy_archetype,
              COALESCE(SUM(tu.estimated_cost_usd), 0) as total_cost,
              COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
              COALESCE(SUM(trades.trade_count), 0) as trade_count,
              COALESCE(SUM(trades.total_pnl), 0) as total_pnl
            FROM agents a
            LEFT JOIN agent_token_usage tu ON tu.agent_id = a.id
              AND tu.date >= NOW() - INTERVAL '90 days'
            LEFT JOIN (
              SELECT agent_id,
                COUNT(*) as trade_count,
                SUM(pnl) as total_pnl
              FROM agent_trades
              WHERE closed_at >= NOW() - INTERVAL '90 days'
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

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


async def _compute_directions(session=None):
    async def _run(s):
        result = await s.execute(text("""
            SELECT direction,
              COUNT(*) as trade_count,
              COUNT(*) FILTER (WHERE pnl > 0) as wins,
              COALESCE(SUM(pnl), 0) as total_pnl,
              COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) as gross_wins,
              COALESCE(ABS(SUM(pnl) FILTER (WHERE pnl < 0)), 0) as gross_losses,
              AVG(duration_minutes) as avg_duration_minutes
            FROM agent_trades
            WHERE closed_at >= NOW() - INTERVAL '90 days'
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

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


async def _compute_drawdowns(session=None):
    async def _run(s):
        result = await s.execute(text("""
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
            for r in result.mappings().all()
        ]

    if session:
        return await _run(session)
    async with async_session() as s:
        return await _run(s)


# ---------------------------------------------------------------------------
# 0. GET /analytics/all — consolidated endpoint (single cache key)
# ---------------------------------------------------------------------------
@router.get("/all")
async def get_all_analytics():
    async def _compute():
        async with async_session() as s:
            summary = await _compute_summary(s)
            archetypes = await _compute_archetypes(s)
            sources = await _compute_sources(s)
            timeframes = await _compute_timeframes(s)
            daily_pnl = await _compute_daily_pnl(s)
            daily_archetype_pnl = await _compute_daily_archetype_pnl(s)
            symbols = await _compute_symbols(s)
            daily_token_cost = await _compute_daily_token_cost(s)
            model_costs = await _compute_model_costs(s)
            archetype_costs = await _compute_archetype_costs(s)
            directions = await _compute_directions(s)
            drawdowns = await _compute_drawdowns(s)

        return {
            "summary": summary,
            "archetypeStats": archetypes,
            "sourceStats": sources,
            "timeframeStats": timeframes,
            "dailyPnl": daily_pnl,
            "dailyArchetypePnl": daily_archetype_pnl,
            "symbolStats": symbols,
            "dailyTokenCost": daily_token_cost,
            "modelCosts": model_costs,
            "archetypeCosts": archetype_costs,
            "directionStats": directions,
            "agentDrawdowns": drawdowns,
        }

    return await _cached("all", _compute)


# ---------------------------------------------------------------------------
# 1. GET /analytics/summary
# ---------------------------------------------------------------------------
@router.get("/summary")
async def get_summary():
    return await _cached("summary", _compute_summary)


# ---------------------------------------------------------------------------
# 2. GET /analytics/archetypes
# ---------------------------------------------------------------------------
@router.get("/archetypes")
async def get_archetypes():
    return await _cached("archetypes", _compute_archetypes)


# ---------------------------------------------------------------------------
# 3. GET /analytics/sources
# ---------------------------------------------------------------------------
@router.get("/sources")
async def get_sources():
    return await _cached("sources", _compute_sources)


# ---------------------------------------------------------------------------
# 4. GET /analytics/timeframes
# ---------------------------------------------------------------------------
@router.get("/timeframes")
async def get_timeframes():
    return await _cached("timeframes", _compute_timeframes)


# ---------------------------------------------------------------------------
# 5. GET /analytics/daily-pnl
# ---------------------------------------------------------------------------
@router.get("/daily-pnl")
async def get_daily_pnl():
    return await _cached("daily_pnl", _compute_daily_pnl)


# ---------------------------------------------------------------------------
# 6. GET /analytics/daily-archetype-pnl
# ---------------------------------------------------------------------------
@router.get("/daily-archetype-pnl")
async def get_daily_archetype_pnl():
    return await _cached("daily_archetype_pnl", _compute_daily_archetype_pnl)


# ---------------------------------------------------------------------------
# 7. GET /analytics/symbols
# ---------------------------------------------------------------------------
@router.get("/symbols")
async def get_symbols():
    return await _cached("symbols", _compute_symbols)


# ---------------------------------------------------------------------------
# 8. GET /analytics/daily-token-cost
# ---------------------------------------------------------------------------
@router.get("/daily-token-cost")
async def get_daily_token_cost():
    return await _cached("daily_token_cost", _compute_daily_token_cost)


# ---------------------------------------------------------------------------
# 9. GET /analytics/model-costs
# ---------------------------------------------------------------------------
@router.get("/model-costs")
async def get_model_costs():
    return await _cached("model_costs", _compute_model_costs)


# ---------------------------------------------------------------------------
# 10. GET /analytics/archetype-costs
# ---------------------------------------------------------------------------
@router.get("/archetype-costs")
async def get_archetype_costs():
    return await _cached("archetype_costs", _compute_archetype_costs)


# ---------------------------------------------------------------------------
# 11. GET /analytics/directions
# ---------------------------------------------------------------------------
@router.get("/directions")
async def get_directions():
    return await _cached("directions", _compute_directions)


# ---------------------------------------------------------------------------
# 12. GET /analytics/drawdowns
# ---------------------------------------------------------------------------
@router.get("/drawdowns")
async def get_drawdowns():
    return await _cached("drawdowns", _compute_drawdowns)
