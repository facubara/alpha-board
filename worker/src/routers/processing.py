"""Processing API endpoints — Phase 1 of moving DB queries from web to worker.

GET /processing/summaries            — Pending counts + last run per task type
GET /processing/runs?limit=20        — Recent processing run history
GET /processing/agents/{agent_id}/analysis — Agent analysis history
"""

import logging
from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import text

from src.db import async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/processing", tags=["processing"])


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _format_dt(val: Any) -> str | None:
    """Convert a datetime value to ISO string, or None."""
    if val is None:
        return None
    return val.isoformat() if hasattr(val, "isoformat") else str(val)


def _map_processing_run(row: Any) -> dict:
    """Map a processing_runs row to camelCase dict."""
    return {
        "id": row.id,
        "taskType": row.task_type,
        "status": row.status,
        "totalItems": row.total_items,
        "processedItems": row.processed_items,
        "errorCount": row.error_count,
        "lastError": row.last_error,
        "startedAt": _format_dt(row.started_at),
        "pausedAt": _format_dt(row.paused_at),
        "completedAt": _format_dt(row.completed_at),
    }


# ------------------------------------------------------------------
# GET /processing/summaries
# ------------------------------------------------------------------


@router.get("/summaries")
async def get_processing_summaries():
    """Pending counts and last run for each of the 5 processing task types."""

    task_types = [
        "tweet_sentiment",
        "memecoin_sentiment",
        "agent_review",
        "trade_memory",
        "post_mortem",
    ]

    async with async_session() as session:
        # Pending counts via UNION ALL
        pending_result = await session.execute(text("""
            SELECT
              'tweet_sentiment' AS task_type,
              (SELECT COUNT(*) FROM tweets t LEFT JOIN tweet_signals s ON s.tweet_id = t.id WHERE s.id IS NULL) AS cnt
            UNION ALL SELECT
              'memecoin_sentiment',
              (SELECT COUNT(*) FROM memecoin_tweets t LEFT JOIN memecoin_tweet_signals s ON s.tweet_id = t.id WHERE s.id IS NULL)
            UNION ALL SELECT
              'agent_review',
              (SELECT COUNT(*) FROM agents a WHERE a.status = 'active'
                AND NOT EXISTS (SELECT 1 FROM agent_analysis_history h WHERE h.agent_id = a.id AND h.created_at > NOW() - INTERVAL '7 days'))
            UNION ALL SELECT
              'trade_memory',
              (SELECT COUNT(*) FROM agent_trades t LEFT JOIN agent_memory m ON m.trade_id = t.id WHERE m.id IS NULL AND t.closed_at IS NOT NULL)
            UNION ALL SELECT
              'post_mortem',
              (SELECT COUNT(*) FROM agents a WHERE a.status = 'discarded'
                AND NOT EXISTS (SELECT 1 FROM fleet_lessons l WHERE l.agent_id = a.id))
        """))
        pending_rows = pending_result.fetchall()

        pending_map: dict[str, int] = {}
        for row in pending_rows:
            pending_map[row.task_type] = int(row.cnt)

        # Last run per task type using DISTINCT ON
        last_run_result = await session.execute(text("""
            SELECT DISTINCT ON (task_type)
              id, task_type, status, total_items, processed_items,
              error_count, last_error, started_at, paused_at, completed_at
            FROM processing_runs
            ORDER BY task_type, started_at DESC
        """))
        last_run_rows = last_run_result.fetchall()

        last_run_map: dict[str, dict] = {}
        for row in last_run_rows:
            last_run_map[row.task_type] = _map_processing_run(row)

    return [
        {
            "taskType": task_type,
            "pendingCount": pending_map.get(task_type, 0),
            "lastRun": last_run_map.get(task_type, None),
        }
        for task_type in task_types
    ]


# ------------------------------------------------------------------
# GET /processing/runs
# ------------------------------------------------------------------


@router.get("/runs")
async def get_processing_runs(limit: int = Query(default=20, ge=1, le=100)):
    """Recent processing run history."""

    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT id, task_type, status, total_items, processed_items,
                       error_count, last_error, started_at, paused_at, completed_at
                FROM processing_runs
                ORDER BY started_at DESC
                LIMIT :limit
            """),
            {"limit": limit},
        )
        rows = result.fetchall()

    return [_map_processing_run(row) for row in rows]


# ------------------------------------------------------------------
# GET /processing/agents/{agent_id}/analysis
# ------------------------------------------------------------------


@router.get("/agents/{agent_id}/analysis")
async def get_agent_analysis(agent_id: int):
    """Analysis history for a specific agent."""

    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT id, agent_id, analysis_type, summary, full_analysis,
                       recommendations, metrics_snapshot, processing_run_id, created_at
                FROM agent_analysis_history
                WHERE agent_id = :agent_id
                ORDER BY created_at DESC
            """),
            {"agent_id": agent_id},
        )
        rows = result.fetchall()

    return [
        {
            "id": row.id,
            "agentId": row.agent_id,
            "analysisType": row.analysis_type,
            "summary": row.summary,
            "fullAnalysis": row.full_analysis,
            "recommendations": row.recommendations or [],
            "metricsSnapshot": row.metrics_snapshot or {},
            "processingRunId": row.processing_run_id,
            "createdAt": _format_dt(row.created_at),
        }
        for row in rows
    ]
