"""Agents router — Phase 3.

Provides ~19 endpoints for agent CRUD, leaderboard, trades, decisions,
positions, prompts, token usage, comparison, and fleet management.
"""

import asyncio
import json
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from src.db import async_session

router = APIRouter(prefix="/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class SavePromptRequest(BaseModel):
    systemPrompt: str


class UpdateModelsRequest(BaseModel):
    scanModel: str
    tradeModel: str
    evolutionModel: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_float(val) -> float | None:
    """Convert a Decimal/numeric value to float, returning None for NULL."""
    if val is None:
        return None
    return float(val)


def _safe_iso(val) -> str | None:
    """Convert a datetime to ISO-8601 string, returning None for NULL."""
    if val is None:
        return None
    return val.isoformat()


def _safe_json(val):
    """Return JSON-serialisable value (passthrough dicts, parse strings)."""
    if val is None:
        return None
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val
    return val


# ---------------------------------------------------------------------------
# Shared SQL fragments
# ---------------------------------------------------------------------------

LEADERBOARD_SQL = """
SELECT a.id, a.name, a.display_name, a.strategy_archetype, a.timeframe, a.engine, a.source,
  a.scan_model, a.trade_model, a.evolution_model, a.status, a.initial_balance,
  a.uuid, a.last_cycle_at, a.discarded_at, a.discard_reason,
  p.cash_balance, p.total_equity, p.total_realized_pnl, p.total_fees_paid,
  (p.total_equity - a.initial_balance) as total_pnl,
  (SELECT COUNT(*) FROM agent_trades WHERE agent_id = a.id) as trade_count,
  (SELECT COUNT(*) FILTER (WHERE pnl > 0) FROM agent_trades WHERE agent_id = a.id) as wins,
  (SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM agent_token_usage WHERE agent_id = a.id) as total_token_cost,
  (SELECT COUNT(*) FROM agent_positions WHERE agent_id = a.id) as open_positions
FROM agents a JOIN agent_portfolios p ON a.id = p.agent_id
"""

TRADES_SQL = """
SELECT t.id, t.agent_id, sym.symbol, t.direction, t.entry_price, t.exit_price, t.position_size,
  t.pnl, t.fees, t.exit_reason, t.opened_at, t.closed_at, t.duration_minutes, d.reasoning_summary
FROM agent_trades t
JOIN symbols sym ON sym.id = t.symbol_id
LEFT JOIN agent_decisions d ON d.id = t.decision_id
WHERE t.agent_id = :agent_id ORDER BY t.closed_at DESC LIMIT 200
"""

POSITIONS_SQL = """
SELECT pos.id, pos.agent_id, sym.symbol, pos.direction, pos.entry_price, pos.position_size,
  pos.stop_loss, pos.take_profit, pos.opened_at, pos.unrealized_pnl
FROM agent_positions pos JOIN symbols sym ON sym.id = pos.symbol_id
"""


def _format_leaderboard_row(r) -> dict:
    """Convert a leaderboard SQL row to a camelCase dict."""
    trade_count = int(r.trade_count)
    wins = int(r.wins)
    total_pnl = _safe_float(r.total_pnl)
    total_realized_pnl = _safe_float(r.total_realized_pnl)
    unrealized_pnl = (total_pnl - total_realized_pnl) if total_pnl is not None and total_realized_pnl is not None else 0.0

    return {
        "id": r.id,
        "name": r.name,
        "displayName": r.display_name,
        "strategyArchetype": r.strategy_archetype,
        "timeframe": r.timeframe,
        "engine": r.engine,
        "source": r.source,
        "scanModel": r.scan_model,
        "tradeModel": r.trade_model,
        "evolutionModel": r.evolution_model,
        "status": r.status,
        "initialBalance": _safe_float(r.initial_balance),
        "uuid": str(r.uuid),
        "lastCycleAt": _safe_iso(r.last_cycle_at),
        "discardedAt": _safe_iso(r.discarded_at),
        "discardReason": r.discard_reason,
        "cashBalance": _safe_float(r.cash_balance),
        "totalEquity": _safe_float(r.total_equity),
        "totalRealizedPnl": total_realized_pnl,
        "totalFeesPaid": _safe_float(r.total_fees_paid),
        "totalPnl": total_pnl,
        "tradeCount": trade_count,
        "wins": wins,
        "winRate": round(wins / trade_count, 4) if trade_count > 0 else 0.0,
        "unrealizedPnl": round(unrealized_pnl, 2),
        "totalTokenCost": _safe_float(r.total_token_cost),
        "openPositions": int(r.open_positions),
    }


def _format_trade_row(r) -> dict:
    """Convert a trade SQL row to a camelCase dict."""
    return {
        "id": r.id,
        "agentId": r.agent_id,
        "symbol": r.symbol,
        "direction": r.direction,
        "entryPrice": _safe_float(r.entry_price),
        "exitPrice": _safe_float(r.exit_price),
        "positionSize": _safe_float(r.position_size),
        "pnl": _safe_float(r.pnl),
        "fees": _safe_float(r.fees),
        "exitReason": r.exit_reason,
        "openedAt": _safe_iso(r.opened_at),
        "closedAt": _safe_iso(r.closed_at),
        "durationMinutes": r.duration_minutes,
        "reasoningSummary": r.reasoning_summary,
    }


def _format_position_row(r) -> dict:
    """Convert a position SQL row to a camelCase dict."""
    return {
        "id": r.id,
        "agentId": r.agent_id,
        "symbol": r.symbol,
        "direction": r.direction,
        "entryPrice": _safe_float(r.entry_price),
        "positionSize": _safe_float(r.position_size),
        "stopLoss": _safe_float(r.stop_loss),
        "takeProfit": _safe_float(r.take_profit),
        "openedAt": _safe_iso(r.opened_at),
        "unrealizedPnl": _safe_float(r.unrealized_pnl),
    }


# ===========================================================================
# READ ENDPOINTS
# ===========================================================================


# 1. GET /agents/leaderboard
@router.get("/leaderboard")
async def get_leaderboard():
    """All non-discarded agents with leaderboard metrics."""
    sql = LEADERBOARD_SQL + """
    WHERE a.status != 'discarded'
    ORDER BY (p.total_equity - a.initial_balance) DESC
    """
    async with async_session() as session:
        result = await session.execute(text(sql))
        rows = result.all()
    return [_format_leaderboard_row(r) for r in rows]


# 2. GET /agents/discarded
@router.get("/discarded")
async def get_discarded():
    """Discarded agents, ordered by discard date."""
    sql = LEADERBOARD_SQL + """
    WHERE a.status = 'discarded'
    ORDER BY a.discarded_at DESC
    """
    async with async_session() as session:
        result = await session.execute(text(sql))
        rows = result.all()
    return [_format_leaderboard_row(r) for r in rows]


# 9. GET /agents/positions (all agents) — defined before /{agent_id} to avoid route conflict
@router.get("/positions")
async def get_all_positions():
    """All open positions across all agents."""
    sql = POSITIONS_SQL + " ORDER BY pos.agent_id, pos.opened_at DESC"
    async with async_session() as session:
        result = await session.execute(text(sql))
        rows = result.all()
    return [_format_position_row(r) for r in rows]


# 10. GET /agents/compare?ids=1,2,3
@router.get("/compare")
async def compare_agents(ids: str = Query(..., description="Comma-separated agent IDs (max 4)")):
    """Comparison data for up to 4 agents side by side."""
    try:
        agent_ids = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids must be comma-separated integers")
    if len(agent_ids) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 agents for comparison")
    if len(agent_ids) == 0:
        raise HTTPException(status_code=400, detail="At least one agent ID required")

    async def _fetch_detail(aid: int):
        sql = LEADERBOARD_SQL + " WHERE a.id = :id"
        async with async_session() as session:
            result = await session.execute(text(sql), {"id": aid})
            row = result.first()
        if row is None:
            return None
        return _format_leaderboard_row(row)

    async def _fetch_trades(aid: int):
        async with async_session() as session:
            result = await session.execute(text(TRADES_SQL), {"agent_id": aid})
            rows = result.all()
        return [_format_trade_row(r) for r in rows]

    # Fetch all in parallel
    detail_tasks = [_fetch_detail(aid) for aid in agent_ids]
    trade_tasks = [_fetch_trades(aid) for aid in agent_ids]
    all_results = await asyncio.gather(*detail_tasks, *trade_tasks)

    n = len(agent_ids)
    details = all_results[:n]
    trade_lists = all_results[n:]

    agents = [d for d in details if d is not None]
    trades = {}
    for i, aid in enumerate(agent_ids):
        if details[i] is not None:
            trades[str(aid)] = trade_lists[i]

    return {"agents": agents, "trades": trades}


# 11. GET /agents/symbol/{symbol}/activity
@router.get("/symbol/{symbol}/activity")
async def get_symbol_activity(symbol: str):
    """Positions and recent trades involving a given symbol (prefix match)."""
    pattern = symbol + "%"

    positions_sql = """
    SELECT pos.id, pos.agent_id, sym.symbol, pos.direction, pos.entry_price, pos.position_size,
      pos.stop_loss, pos.take_profit, pos.opened_at, pos.unrealized_pnl
    FROM agent_positions pos JOIN symbols sym ON sym.id = pos.symbol_id
    WHERE sym.symbol LIKE :pattern
    ORDER BY pos.opened_at DESC
    """

    trades_sql = """
    SELECT t.id, t.agent_id, sym.symbol, t.direction, t.entry_price, t.exit_price, t.position_size,
      t.pnl, t.fees, t.exit_reason, t.opened_at, t.closed_at, t.duration_minutes, d.reasoning_summary
    FROM agent_trades t
    JOIN symbols sym ON sym.id = t.symbol_id
    LEFT JOIN agent_decisions d ON d.id = t.decision_id
    WHERE sym.symbol LIKE :pattern
    ORDER BY t.closed_at DESC LIMIT 200
    """

    async with async_session() as session:
        pos_result = await session.execute(text(positions_sql), {"pattern": pattern})
        trd_result = await session.execute(text(trades_sql), {"pattern": pattern})
        positions = pos_result.all()
        trades = trd_result.all()

    return {
        "positions": [_format_position_row(r) for r in positions],
        "trades": [_format_trade_row(r) for r in trades],
    }


# 12. GET /agents/active-llm
@router.get("/active-llm")
async def get_active_llm_agents():
    """Active LLM agents (for dropdowns / selectors)."""
    sql = "SELECT id, display_name as name FROM agents WHERE engine = 'llm' AND status = 'active' ORDER BY id"
    async with async_session() as session:
        result = await session.execute(text(sql))
        rows = result.all()
    return [{"id": r.id, "name": r.name} for r in rows]


# 3. GET /agents/{agent_id}
@router.get("/{agent_id}")
async def get_agent_detail(agent_id: int):
    """Single agent detail with leaderboard metrics."""
    sql = LEADERBOARD_SQL + " WHERE a.id = :id"
    async with async_session() as session:
        result = await session.execute(text(sql), {"id": agent_id})
        row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _format_leaderboard_row(row)


# 4. GET /agents/{agent_id}/trades
@router.get("/{agent_id}/trades")
async def get_agent_trades(agent_id: int):
    """Trade history for a single agent."""
    async with async_session() as session:
        result = await session.execute(text(TRADES_SQL), {"agent_id": agent_id})
        rows = result.all()
    return [_format_trade_row(r) for r in rows]


# 5. GET /agents/{agent_id}/decisions
@router.get("/{agent_id}/decisions")
async def get_agent_decisions(agent_id: int):
    """Decision log for a single agent."""
    sql = """
    SELECT d.id, d.agent_id, d.action, sym.symbol, d.reasoning_full, d.reasoning_summary,
      d.action_params, d.model_used, d.input_tokens, d.output_tokens, d.estimated_cost_usd,
      d.prompt_version, d.decided_at
    FROM agent_decisions d LEFT JOIN symbols sym ON sym.id = d.symbol_id
    WHERE d.agent_id = :agent_id ORDER BY d.decided_at DESC LIMIT 200
    """
    async with async_session() as session:
        result = await session.execute(text(sql), {"agent_id": agent_id})
        rows = result.all()
    return [
        {
            "id": r.id,
            "agentId": r.agent_id,
            "action": r.action,
            "symbol": r.symbol,
            "reasoningFull": r.reasoning_full,
            "reasoningSummary": r.reasoning_summary,
            "actionParams": _safe_json(r.action_params),
            "modelUsed": r.model_used,
            "inputTokens": r.input_tokens,
            "outputTokens": r.output_tokens,
            "estimatedCostUsd": _safe_float(r.estimated_cost_usd),
            "promptVersion": r.prompt_version,
            "decidedAt": _safe_iso(r.decided_at),
        }
        for r in rows
    ]


# 6. GET /agents/{agent_id}/prompts
@router.get("/{agent_id}/prompts")
async def get_agent_prompts(agent_id: int):
    """Prompt version history for a single agent."""
    sql = """
    SELECT id, agent_id, version, system_prompt, source, diff_from_previous,
      performance_at_change, created_at, is_active
    FROM agent_prompts WHERE agent_id = :agent_id ORDER BY version DESC
    """
    async with async_session() as session:
        result = await session.execute(text(sql), {"agent_id": agent_id})
        rows = result.all()
    return [
        {
            "id": r.id,
            "agentId": r.agent_id,
            "version": r.version,
            "systemPrompt": r.system_prompt,
            "source": r.source,
            "diffFromPrevious": r.diff_from_previous,
            "performanceAtChange": _safe_json(r.performance_at_change),
            "createdAt": _safe_iso(r.created_at),
            "isActive": r.is_active,
        }
        for r in rows
    ]


# 7. GET /agents/{agent_id}/positions
@router.get("/{agent_id}/positions")
async def get_agent_positions(agent_id: int):
    """Open positions for a single agent."""
    sql = POSITIONS_SQL + " WHERE pos.agent_id = :agent_id ORDER BY pos.opened_at DESC"
    async with async_session() as session:
        result = await session.execute(text(sql), {"agent_id": agent_id})
        rows = result.all()
    return [_format_position_row(r) for r in rows]


# 8. GET /agents/{agent_id}/token-usage
@router.get("/{agent_id}/token-usage")
async def get_agent_token_usage(agent_id: int):
    """Aggregated token usage by model and task type."""
    sql = """
    SELECT model, task_type, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens,
      SUM(estimated_cost_usd) as estimated_cost_usd
    FROM agent_token_usage WHERE agent_id = :agent_id
    GROUP BY model, task_type ORDER BY model, task_type
    """
    async with async_session() as session:
        result = await session.execute(text(sql), {"agent_id": agent_id})
        rows = result.all()
    return [
        {
            "model": r.model,
            "taskType": r.task_type,
            "inputTokens": int(r.input_tokens),
            "outputTokens": int(r.output_tokens),
            "estimatedCostUsd": _safe_float(r.estimated_cost_usd),
        }
        for r in rows
    ]


# ===========================================================================
# WRITE ENDPOINTS
# ===========================================================================


# 13. POST /agents/{agent_id}/toggle
@router.post("/{agent_id}/toggle")
async def toggle_agent(agent_id: int):
    """Toggle agent status between active and paused."""
    sql = """
    UPDATE agents SET status = CASE WHEN status = 'active' THEN 'paused' ELSE 'active' END
    WHERE id = :id AND status != 'discarded' RETURNING status
    """
    async with async_session() as session:
        result = await session.execute(text(sql), {"id": agent_id})
        row = result.first()
        await session.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found or is discarded")
    return {"status": row.status}


# 14. POST /agents/pause-llm
@router.post("/pause-llm")
async def pause_llm_agents():
    """Pause all active LLM agents."""
    sql = "UPDATE agents SET status = 'paused' WHERE engine = 'llm' AND status = 'active' RETURNING id"
    async with async_session() as session:
        result = await session.execute(text(sql))
        rows = result.all()
        await session.commit()
    return {"count": len(rows)}


# 15. POST /agents/{agent_id}/reactivate
@router.post("/{agent_id}/reactivate")
async def reactivate_agent(agent_id: int):
    """Reactivate a discarded agent."""
    sql = """
    UPDATE agents SET status = 'active', discarded_at = NULL, discard_reason = NULL
    WHERE id = :id AND status = 'discarded' RETURNING id
    """
    async with async_session() as session:
        result = await session.execute(text(sql), {"id": agent_id})
        row = result.first()
        await session.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found or is not discarded")
    return {"id": row.id, "status": "active"}


# 16. DELETE /agents/{agent_id}
@router.delete("/{agent_id}")
async def delete_agent(agent_id: int):
    """Delete an agent and all related data (cascade)."""
    # Order matters — respect foreign key constraints
    delete_tables = [
        "agent_token_usage",
        "agent_memory",
        "agent_decisions",
        "agent_trades",
        "agent_positions",
        "agent_prompts",
        "agent_portfolios",
        "agents",
    ]
    async with async_session() as session:
        # Verify agent exists
        check = await session.execute(
            text("SELECT id FROM agents WHERE id = :id"), {"id": agent_id}
        )
        if check.first() is None:
            raise HTTPException(status_code=404, detail="Agent not found")

        for table in delete_tables:
            col = "agent_id" if table != "agents" else "id"
            await session.execute(
                text(f"DELETE FROM {table} WHERE {col} = :id"), {"id": agent_id}
            )
        await session.commit()

    return {"deleted": True, "agentId": agent_id}


# 17. POST /agents/{agent_id}/prompts
@router.post("/{agent_id}/prompts")
async def save_agent_prompt(agent_id: int, body: SavePromptRequest):
    """Save a new prompt version for an agent."""
    async with async_session() as session:
        # Get current max version
        result = await session.execute(
            text("SELECT COALESCE(MAX(version), 0) as max_ver FROM agent_prompts WHERE agent_id = :agent_id"),
            {"agent_id": agent_id},
        )
        row = result.first()
        new_version = row.max_ver + 1

        # Deactivate current active prompt
        await session.execute(
            text("UPDATE agent_prompts SET is_active = false WHERE agent_id = :agent_id AND is_active = true"),
            {"agent_id": agent_id},
        )

        # Insert new prompt
        insert_sql = """
        INSERT INTO agent_prompts (agent_id, version, system_prompt, source, is_active)
        VALUES (:agent_id, :version, :system_prompt, 'human', true)
        RETURNING id, agent_id, version, system_prompt, source, created_at, is_active
        """
        result = await session.execute(
            text(insert_sql),
            {
                "agent_id": agent_id,
                "version": new_version,
                "system_prompt": body.systemPrompt,
            },
        )
        r = result.first()
        await session.commit()

    return {
        "id": r.id,
        "agentId": r.agent_id,
        "version": r.version,
        "systemPrompt": r.system_prompt,
        "source": r.source,
        "createdAt": _safe_iso(r.created_at),
        "isActive": r.is_active,
    }


# 18. PATCH /agents/{agent_id}/models
@router.patch("/{agent_id}/models")
async def update_agent_models(agent_id: int, body: UpdateModelsRequest):
    """Update the scan/trade/evolution models for an agent."""
    sql = """
    UPDATE agents SET scan_model = :scan, trade_model = :trade, evolution_model = :evolution
    WHERE id = :id RETURNING id, scan_model, trade_model, evolution_model
    """
    async with async_session() as session:
        result = await session.execute(
            text(sql),
            {
                "id": agent_id,
                "scan": body.scanModel,
                "trade": body.tradeModel,
                "evolution": body.evolutionModel,
            },
        )
        row = result.first()
        await session.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {
        "id": row.id,
        "scanModel": row.scan_model,
        "tradeModel": row.trade_model,
        "evolutionModel": row.evolution_model,
    }
