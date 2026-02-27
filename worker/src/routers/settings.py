"""Settings router — Phase 1 of moving DB queries from web to worker.

Provides endpoints for reading/toggling LLM settings and cost breakdown.
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from src.db import async_session

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/llm")
async def get_llm_settings():
    """Return all LLM settings rows."""
    try:
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT section_key, display_name, description, enabled, "
                    "has_api_cost, task_type, updated_at "
                    "FROM llm_settings ORDER BY section_key"
                )
            )
            rows = result.fetchall()
            return [
                {
                    "key": row[0],
                    "displayName": row[1],
                    "description": row[2],
                    "enabled": row[3],
                    "hasApiCost": row[4],
                    "taskType": row[5],
                    "updatedAt": row[6].isoformat() if row[6] else None,
                }
                for row in rows
            ]
    except Exception:
        return []


@router.get("/llm/costs")
async def get_llm_costs():
    """Return cost breakdown per LLM section (all-time and last 30 days)."""
    task_type_to_key = {
        "trade": "llm_trade_decisions",
        "evolution": "prompt_evolution",
        "postmortem": "post_mortem",
        "scan": "trade_memory",
    }

    try:
        async with async_session() as session:
            # Token usage costs by task_type
            token_result = await session.execute(
                text(
                    "SELECT task_type, "
                    "COALESCE(SUM(estimated_cost_usd), 0) as cost_alltime, "
                    "COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' "
                    "THEN estimated_cost_usd ELSE 0 END), 0) as cost_30d "
                    "FROM agent_token_usage "
                    "WHERE task_type IN ('trade', 'evolution', 'postmortem', 'scan') "
                    "GROUP BY task_type"
                )
            )
            token_rows = token_result.fetchall()

            costs = {}
            for row in token_rows:
                task_type = row[0]
                key = task_type_to_key.get(task_type)
                if key:
                    costs[key] = {
                        "key": key,
                        "costAlltime": float(row[1]),
                        "cost30d": float(row[2]),
                    }

            # Tweet sentiment costs
            tweet_result = await session.execute(
                text(
                    "SELECT COALESCE(SUM(estimated_cost_usd), 0) as cost_alltime, "
                    "COALESCE(SUM(CASE WHEN analyzed_at >= CURRENT_DATE - INTERVAL '30 days' "
                    "THEN estimated_cost_usd ELSE 0 END), 0) as cost_30d "
                    "FROM tweet_signals"
                )
            )
            tweet_row = tweet_result.fetchone()
            if tweet_row:
                costs["tweet_sentiment"] = {
                    "key": "tweet_sentiment",
                    "costAlltime": float(tweet_row[0]),
                    "cost30d": float(tweet_row[1]),
                }

            return list(costs.values())
    except Exception:
        return []


@router.post("/llm/{key}/toggle")
async def toggle_llm_setting(key: str):
    """Toggle a section's enabled state."""
    async with async_session() as session:
        result = await session.execute(
            text(
                "UPDATE llm_settings SET enabled = NOT enabled, updated_at = now() "
                "WHERE section_key = :key RETURNING section_key, enabled"
            ),
            {"key": key},
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
        await session.commit()
        return {"key": row[0], "enabled": row[1]}
