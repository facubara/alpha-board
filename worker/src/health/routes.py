"""Status API endpoints.

GET /status/services — Current status for all services
GET /status/history  — Daily heatmap data (default 90 days)
GET /status/incidents — Recent incidents list
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from src.db import async_session
from src.health.checker import SERVICE_NAMES
from src.models.db import ServiceDailyStatus, ServiceHealthCheck, ServiceIncident

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/status", tags=["status"])


@router.get("/services")
async def get_current_status():
    """Current status for all monitored services."""
    async with async_session() as session:
        # Get latest check per service using a subquery
        latest_subq = (
            select(
                ServiceHealthCheck.service,
                func.max(ServiceHealthCheck.id).label("max_id"),
            )
            .group_by(ServiceHealthCheck.service)
            .subquery()
        )

        result = await session.execute(
            select(ServiceHealthCheck)
            .join(latest_subq, ServiceHealthCheck.id == latest_subq.c.max_id)
            .order_by(ServiceHealthCheck.service)
        )
        checks = result.scalars().all()

        # Active incidents
        incidents_result = await session.execute(
            select(ServiceIncident)
            .where(ServiceIncident.resolved_at.is_(None))
            .order_by(ServiceIncident.started_at.desc())
        )
        active_incidents = incidents_result.scalars().all()

        services = []
        worst_status = "operational"
        status_priority = {"operational": 0, "degraded": 1, "down": 2}

        for check in checks:
            services.append({
                "name": SERVICE_NAMES.get(check.service, check.service),
                "slug": check.service,
                "status": check.status,
                "latency_ms": check.latency_ms,
                "last_checked": check.checked_at.isoformat(),
            })
            if status_priority.get(check.status, 0) > status_priority.get(worst_status, 0):
                worst_status = check.status

        incidents_out = [
            {
                "id": inc.id,
                "service": inc.service,
                "serviceName": SERVICE_NAMES.get(inc.service, inc.service),
                "status": inc.status,
                "startedAt": inc.started_at.isoformat(),
                "errorSummary": inc.error_summary,
                "durationMinutes": int(
                    (datetime.now(timezone.utc) - inc.started_at).total_seconds() / 60
                ),
            }
            for inc in active_incidents
        ]

        return {
            "overall": worst_status,
            "services": services,
            "active_incidents": incidents_out,
        }


@router.get("/history")
async def get_status_history(days: int = Query(default=90, ge=1, le=180)):
    """Daily status heatmap data for all services."""
    async with async_session() as session:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date()

        result = await session.execute(
            select(ServiceDailyStatus)
            .where(ServiceDailyStatus.date >= cutoff)
            .order_by(ServiceDailyStatus.service, ServiceDailyStatus.date.desc())
        )
        rows = result.scalars().all()

        # Group by service
        by_service: dict[str, list] = {}
        for row in rows:
            by_service.setdefault(row.service, []).append(row)

        services = []
        for slug, daily_rows in sorted(by_service.items()):
            # Compute rolling uptime averages
            now_date = datetime.now(timezone.utc).date()
            uptime_30d = _compute_uptime(daily_rows, now_date, 30)
            uptime_90d = _compute_uptime(daily_rows, now_date, 90)

            daily = [
                {
                    "date": row.date.isoformat(),
                    "uptime_pct": float(row.uptime_pct),
                    "incidents": row.incidents,
                    "worst_status": row.worst_status,
                    "avg_latency_ms": row.avg_latency_ms,
                }
                for row in daily_rows
            ]

            services.append({
                "slug": slug,
                "name": SERVICE_NAMES.get(slug, slug),
                "uptime_30d": uptime_30d,
                "uptime_90d": uptime_90d,
                "daily": daily,
            })

        return {"services": services}


@router.get("/incidents")
async def get_incidents(days: int = Query(default=30, ge=1, le=180)):
    """Recent incidents (resolved + active)."""
    async with async_session() as session:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        result = await session.execute(
            select(ServiceIncident)
            .where(ServiceIncident.started_at >= cutoff)
            .order_by(ServiceIncident.started_at.desc())
        )
        incidents = result.scalars().all()

        return [
            {
                "id": inc.id,
                "service": inc.service,
                "serviceName": SERVICE_NAMES.get(inc.service, inc.service),
                "status": inc.status,
                "startedAt": inc.started_at.isoformat(),
                "resolvedAt": inc.resolved_at.isoformat() if inc.resolved_at else None,
                "durationMinutes": inc.duration_minutes,
                "errorSummary": inc.error_summary,
            }
            for inc in incidents
        ]


def _compute_uptime(
    rows: list[ServiceDailyStatus], today, window_days: int
) -> float | None:
    """Compute average uptime_pct over the last N days."""
    cutoff = today - timedelta(days=window_days)
    window_rows = [r for r in rows if r.date > cutoff]
    if not window_rows:
        return None
    total = sum(float(r.uptime_pct) for r in window_rows)
    return round(total / len(window_rows), 2)
