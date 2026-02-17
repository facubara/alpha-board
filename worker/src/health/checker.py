"""Service health checker.

Runs periodic checks against all Alpha Board services, writes results
to service_health_checks, manages incident lifecycle, and handles
daily rollup + retention cleanup.
"""

import logging
import time
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.db import (
    ComputationRun,
    ServiceDailyStatus,
    ServiceHealthCheck,
    ServiceIncident,
    Tweet,
)
from src.pipeline.runner import TIMEFRAME_CONFIG

logger = logging.getLogger(__name__)

# Display names for each service slug
SERVICE_NAMES: dict[str, str] = {
    "frontend": "Frontend (Vercel)",
    "worker_api": "Worker API (Fly.io)",
    "database": "Database (Neon)",
    "redis": "Redis (Upstash)",
    "binance_api": "Binance API",
    "twitter": "Twitter Polling",
    "pipeline_15m": "Pipeline 15m",
    "pipeline_30m": "Pipeline 30m",
    "pipeline_1h": "Pipeline 1h",
    "pipeline_4h": "Pipeline 4h",
    "pipeline_1d": "Pipeline 1d",
    "pipeline_1w": "Pipeline 1w",
}


class ServiceHealthChecker:
    """Checks health of all Alpha Board services."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def run_all_checks(self) -> None:
        """Run all service health checks and handle incident transitions."""
        checks = [
            ("frontend", self._check_frontend),
            ("worker_api", self._check_worker_api),
            ("database", self._check_database),
            ("redis", self._check_redis),
            ("binance_api", self._check_binance),
            ("twitter", self._check_twitter),
        ]

        # Add pipeline checks for each timeframe
        for tf in TIMEFRAME_CONFIG:
            slug = f"pipeline_{tf}"
            checks.append((slug, lambda s=self, t=tf: s._check_pipeline(t)))

        for slug, check_fn in checks:
            try:
                status, latency_ms, error_msg = await check_fn()
            except Exception as e:
                status, latency_ms, error_msg = "down", None, str(e)

            # Write raw check
            check = ServiceHealthCheck(
                service=slug,
                status=status,
                latency_ms=latency_ms,
                error_message=error_msg,
            )
            self.session.add(check)

            # Handle incident transitions
            await self._handle_incident_transition(slug, status, error_msg)

        await self.session.commit()
        logger.info("Health checks completed for all services")

    async def _handle_incident_transition(
        self, service: str, new_status: str, error_msg: str | None
    ) -> None:
        """Create/resolve incidents based on status transitions."""
        # Find most recent open incident for this service
        result = await self.session.execute(
            select(ServiceIncident)
            .where(
                ServiceIncident.service == service,
                ServiceIncident.resolved_at.is_(None),
            )
            .order_by(ServiceIncident.started_at.desc())
            .limit(1)
        )
        open_incident = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if new_status == "operational":
            # Resolve any open incident
            if open_incident:
                open_incident.resolved_at = now
                duration = (now - open_incident.started_at).total_seconds() / 60
                open_incident.duration_minutes = int(duration)
                logger.info(
                    f"Incident resolved for {service} after {int(duration)}m"
                )
        else:
            # degraded or down — create new incident if none open
            if not open_incident:
                incident = ServiceIncident(
                    service=service,
                    status=new_status,
                    started_at=now,
                    error_summary=error_msg,
                )
                self.session.add(incident)
                logger.warning(
                    f"New incident for {service}: {new_status} — {error_msg}"
                )
            elif open_incident.status != new_status:
                # Status changed (e.g., degraded → down) — update
                open_incident.status = new_status
                if error_msg:
                    open_incident.error_summary = error_msg

    # -------------------------------------------------------------------------
    # Individual check methods
    # -------------------------------------------------------------------------

    async def _check_frontend(self) -> tuple[str, int | None, str | None]:
        """HTTP GET https://alpha-board.com"""
        return await self._http_check(
            "https://alpha-board.com",
            degraded_ms=3000,
        )

    async def _check_worker_api(self) -> tuple[str, int | None, str | None]:
        """HTTP GET https://alpha-worker.fly.dev/health"""
        return await self._http_check(
            "https://alpha-worker.fly.dev/health",
            degraded_ms=2000,
        )

    async def _check_database(self) -> tuple[str, int | None, str | None]:
        """SELECT 1 via existing async engine."""
        start = time.monotonic()
        try:
            result = await self.session.execute(text("SELECT 1"))
            result.scalar()
            latency = int((time.monotonic() - start) * 1000)
            if latency > 500:
                return "degraded", latency, f"Slow query: {latency}ms"
            return "operational", latency, None
        except Exception as e:
            latency = int((time.monotonic() - start) * 1000)
            return "down", latency, str(e)

    async def _check_redis(self) -> tuple[str, int | None, str | None]:
        """PING via existing Redis client."""
        from src.cache import get_redis

        start = time.monotonic()
        try:
            r = await get_redis()
            if not r:
                return "operational", 0, None  # Redis not configured — not an error
            await r.ping()
            latency = int((time.monotonic() - start) * 1000)
            if latency > 200:
                return "degraded", latency, f"Slow ping: {latency}ms"
            return "operational", latency, None
        except Exception as e:
            latency = int((time.monotonic() - start) * 1000)
            return "down", latency, str(e)

    async def _check_binance(self) -> tuple[str, int | None, str | None]:
        """HTTP GET https://api.binance.com/api/v3/ping"""
        return await self._http_check(
            "https://api.binance.com/api/v3/ping",
            degraded_ms=1000,
        )

    async def _check_twitter(self) -> tuple[str, int | None, str | None]:
        """Check latest tweet ingested_at vs staleness thresholds."""
        result = await self.session.execute(
            select(func.max(Tweet.ingested_at))
        )
        latest = result.scalar()
        if latest is None:
            # No tweets at all — not necessarily an error
            return "operational", None, None

        now = datetime.now(timezone.utc)
        age = now - latest
        age_minutes = age.total_seconds() / 60

        if age_minutes > 60:
            return "down", None, f"Last tweet {int(age_minutes)}m ago (>60m)"
        if age_minutes > 30:
            return "degraded", None, f"Last tweet {int(age_minutes)}m ago (>30m)"
        return "operational", None, None

    async def _check_pipeline(self, timeframe: str) -> tuple[str, int | None, str | None]:
        """Check latest computation_run finished_at vs cadence thresholds."""
        config = TIMEFRAME_CONFIG.get(timeframe)
        if not config:
            return "operational", None, None

        cadence_minutes = config["cadence_minutes"]

        result = await self.session.execute(
            select(func.max(ComputationRun.finished_at))
            .where(
                ComputationRun.timeframe == timeframe,
                ComputationRun.status == "completed",
            )
        )
        latest = result.scalar()
        if latest is None:
            return "down", None, "No completed runs found"

        now = datetime.now(timezone.utc)
        age_minutes = (now - latest).total_seconds() / 60

        if age_minutes > cadence_minutes * 3:
            return "down", None, f"Last run {int(age_minutes)}m ago (>{cadence_minutes * 3}m)"
        if age_minutes > cadence_minutes * 1.5:
            return "degraded", None, f"Last run {int(age_minutes)}m ago (>{cadence_minutes * 1.5:.0f}m)"
        return "operational", None, None

    # -------------------------------------------------------------------------
    # HTTP helper
    # -------------------------------------------------------------------------

    async def _http_check(
        self, url: str, degraded_ms: int, timeout_s: int = 10
    ) -> tuple[str, int | None, str | None]:
        """Generic HTTP GET check."""
        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                resp = await client.get(url)
                latency = int((time.monotonic() - start) * 1000)
                if resp.status_code != 200:
                    return "down", latency, f"HTTP {resp.status_code}"
                if latency > degraded_ms:
                    return "degraded", latency, f"Slow response: {latency}ms"
                return "operational", latency, None
        except httpx.TimeoutException:
            latency = int((time.monotonic() - start) * 1000)
            return "down", latency, "Timeout"
        except Exception as e:
            latency = int((time.monotonic() - start) * 1000)
            return "down", latency, str(e)

    # -------------------------------------------------------------------------
    # Daily rollup + retention
    # -------------------------------------------------------------------------

    async def rollup_daily(self) -> None:
        """Aggregate yesterday's checks into service_daily_status."""
        now = datetime.now(timezone.utc)
        yesterday = (now - timedelta(days=1)).date()

        # Get all services that had checks yesterday
        result = await self.session.execute(
            select(ServiceHealthCheck.service)
            .where(
                func.date(ServiceHealthCheck.checked_at) == yesterday,
            )
            .distinct()
        )
        services = [row[0] for row in result.all()]

        for service in services:
            # Aggregate checks for this service on yesterday
            agg = await self.session.execute(
                select(
                    func.count().label("total"),
                    func.count()
                    .filter(ServiceHealthCheck.status == "operational")
                    .label("successful"),
                    func.avg(ServiceHealthCheck.latency_ms).label("avg_lat"),
                    func.max(ServiceHealthCheck.latency_ms).label("max_lat"),
                )
                .where(
                    ServiceHealthCheck.service == service,
                    func.date(ServiceHealthCheck.checked_at) == yesterday,
                )
            )
            row = agg.first()
            if not row or row.total == 0:
                continue

            total = row.total
            successful = row.successful
            uptime = round(successful / total * 100, 2) if total > 0 else 0

            # Worst status
            worst_result = await self.session.execute(
                select(ServiceHealthCheck.status)
                .where(
                    ServiceHealthCheck.service == service,
                    func.date(ServiceHealthCheck.checked_at) == yesterday,
                )
                .order_by(
                    # down > degraded > operational
                    func.case(
                        (ServiceHealthCheck.status == "down", 0),
                        (ServiceHealthCheck.status == "degraded", 1),
                        else_=2,
                    )
                )
                .limit(1)
            )
            worst = worst_result.scalar() or "operational"

            # Count incidents that overlapped this day
            incident_count_result = await self.session.execute(
                select(func.count())
                .select_from(ServiceIncident)
                .where(
                    ServiceIncident.service == service,
                    ServiceIncident.started_at < datetime.combine(
                        yesterday + timedelta(days=1),
                        datetime.min.time(),
                        tzinfo=timezone.utc,
                    ),
                    (
                        ServiceIncident.resolved_at.is_(None)
                        | (
                            ServiceIncident.resolved_at
                            >= datetime.combine(yesterday, datetime.min.time(), tzinfo=timezone.utc)
                        )
                    ),
                )
            )
            incident_count = incident_count_result.scalar() or 0

            # Upsert daily status
            existing = await self.session.execute(
                select(ServiceDailyStatus).where(
                    ServiceDailyStatus.service == service,
                    ServiceDailyStatus.date == yesterday,
                )
            )
            daily = existing.scalar_one_or_none()
            if daily:
                daily.total_checks = total
                daily.successful_checks = successful
                daily.uptime_pct = uptime
                daily.avg_latency_ms = int(row.avg_lat) if row.avg_lat else None
                daily.max_latency_ms = row.max_lat
                daily.incidents = incident_count
                daily.worst_status = worst
            else:
                daily = ServiceDailyStatus(
                    service=service,
                    date=yesterday,
                    total_checks=total,
                    successful_checks=successful,
                    uptime_pct=uptime,
                    avg_latency_ms=int(row.avg_lat) if row.avg_lat else None,
                    max_latency_ms=row.max_lat,
                    incidents=incident_count,
                    worst_status=worst,
                )
                self.session.add(daily)

        await self.session.commit()
        logger.info(f"Daily rollup completed for {len(services)} services")

    async def cleanup_old_checks(self) -> None:
        """Delete old health check rows and daily status rows."""
        now = datetime.now(timezone.utc)

        # Delete raw checks older than 7 days
        cutoff_checks = now - timedelta(days=7)
        result = await self.session.execute(
            delete(ServiceHealthCheck).where(
                ServiceHealthCheck.checked_at < cutoff_checks
            )
        )
        logger.info(f"Cleaned up {result.rowcount} old health check rows")

        # Delete daily status older than 180 days
        cutoff_daily = (now - timedelta(days=180)).date()
        result = await self.session.execute(
            delete(ServiceDailyStatus).where(
                ServiceDailyStatus.date < cutoff_daily
            )
        )
        logger.info(f"Cleaned up {result.rowcount} old daily status rows")

        await self.session.commit()
