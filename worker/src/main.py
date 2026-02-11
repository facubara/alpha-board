"""Alpha Worker entrypoint with FastAPI and APScheduler.

Provides:
- /health — Health check endpoint (detailed, for Fly.io checks)
- /status — Scheduler status and job list
- /trigger/{timeframe} — Manual pipeline trigger
- Scheduled pipeline runs based on timeframe cadence
- Daily retention cleanup for old partitions
"""

import logging
import time
from datetime import datetime, timedelta, timezone

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI, HTTPException
from sqlalchemy import text

from src.config import settings
from src.db import engine
from src.pipeline import TIMEFRAME_CONFIG, PipelineRunner

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Alpha Worker", version="0.1.0")
scheduler = AsyncIOScheduler()

# Pipeline runner instance
runner = PipelineRunner(min_volume_usd=settings.min_volume_usd)

# Track last run times and results for each timeframe
last_runs: dict[str, datetime] = {}
last_results: dict[str, dict] = {}
start_time = time.monotonic()


async def run_timeframe_pipeline(timeframe: str):
    """Run the pipeline for a single timeframe.

    Each timeframe runs as an independent scheduler job so that slow or
    failing timeframes never block the others.
    """
    logger.info(f"Running pipeline for {timeframe}")
    try:
        result = await runner.run(timeframe)
        if result["status"] == "completed":
            last_runs[timeframe] = datetime.now(timezone.utc)
            last_results[timeframe] = result
            logger.info(
                f"Completed {timeframe}: {result.get('symbols', 0)} symbols"
            )
        elif result["status"] == "skipped":
            logger.info(f"Skipped {timeframe}: {result.get('reason')}")
        else:
            last_results[timeframe] = result
            logger.error(f"Failed {timeframe}: {result.get('error')}")
    except Exception as e:
        logger.exception(f"Error running pipeline for {timeframe}: {e}")


@app.get("/health")
async def health():
    """Health check with detailed status for monitoring."""
    uptime_seconds = int(time.monotonic() - start_time)

    # Quick DB connectivity check
    db_status = "ok"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    # Agent stats
    agent_stats = {}
    try:
        async with engine.connect() as conn:
            row = await conn.execute(
                text(
                    "SELECT "
                    "COUNT(*) FILTER (WHERE status = 'active') as active, "
                    "COUNT(*) FILTER (WHERE status = 'paused') as paused "
                    "FROM agents"
                )
            )
            r = row.first()
            if r:
                agent_stats = {"active": r[0], "paused": r[1]}

            pos_row = await conn.execute(text("SELECT COUNT(*) FROM agent_positions"))
            p = pos_row.scalar()
            agent_stats["open_positions"] = p or 0
    except Exception:
        pass

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "uptime_seconds": uptime_seconds,
        "db_connection": db_status,
        "last_runs": {
            tf: {
                "finished_at": str(last_runs[tf]) if tf in last_runs else None,
                "symbols": last_results.get(tf, {}).get("symbols"),
            }
            for tf in TIMEFRAME_CONFIG
        },
        "agents": agent_stats,
    }


@app.get("/status")
async def status():
    """Get scheduler status and job information."""
    jobs = [
        {
            "id": j.id,
            "next_run": str(j.next_run_time) if j.next_run_time else None,
        }
        for j in scheduler.get_jobs()
    ]

    return {
        "scheduler": "running" if scheduler.running else "stopped",
        "jobs": jobs,
        "timeframes": {
            tf: {
                "cadence_minutes": config["cadence_minutes"],
                "last_run": str(last_runs.get(tf)) if tf in last_runs else None,
            }
            for tf, config in TIMEFRAME_CONFIG.items()
        },
    }


@app.post("/trigger/{timeframe}")
async def trigger(timeframe: str):
    """Manually trigger a pipeline run for a specific timeframe.

    Args:
        timeframe: The timeframe to process (15m, 30m, 1h, 4h, 1d, 1w).

    Returns:
        Pipeline run result.
    """
    if timeframe not in TIMEFRAME_CONFIG:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid timeframe. Must be one of: {list(TIMEFRAME_CONFIG.keys())}",
        )

    logger.info(f"Manual trigger for {timeframe}")
    result = await runner.run(timeframe)

    if result["status"] == "completed":
        last_runs[timeframe] = datetime.now(timezone.utc)

    return result


async def retention_cleanup():
    """Drop snapshot/decision partitions older than 90 days and create future partitions.

    Runs daily at 03:00 UTC.
    """
    logger.info("Running retention cleanup")
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=90)

    async with engine.begin() as conn:
        # Find and drop old partitions for snapshots and agent_decisions
        for base_table in ("snapshots", "agent_decisions"):
            # List partitions by querying pg_inherits
            result = await conn.execute(
                text(
                    "SELECT c.relname FROM pg_inherits i "
                    "JOIN pg_class c ON c.oid = i.inhrelid "
                    "JOIN pg_class p ON p.oid = i.inhparent "
                    f"WHERE p.relname = '{base_table}' "
                    "ORDER BY c.relname"
                )
            )
            for row in result:
                partition_name = row[0]
                # Extract year_month from partition name like snapshots_2026_02
                parts = partition_name.rsplit("_", 2)
                if len(parts) >= 3:
                    try:
                        year = int(parts[-2])
                        month = int(parts[-1])
                        partition_date = datetime(year, month, 1, tzinfo=timezone.utc)
                        if partition_date < cutoff.replace(day=1):
                            logger.info(f"Dropping old partition: {partition_name}")
                            await conn.execute(
                                text(f"DROP TABLE IF EXISTS {partition_name}")
                            )
                    except (ValueError, IndexError):
                        continue

        # Create partitions for the next 2 months
        for months_ahead in range(1, 3):
            future = now + timedelta(days=30 * months_ahead)
            year = future.year
            month = future.month
            next_month = month + 1
            next_year = year
            if next_month > 12:
                next_month = 1
                next_year = year + 1

            for base_table in ("snapshots", "agent_decisions"):
                partition_name = f"{base_table}_{year}_{month:02d}"
                try:
                    await conn.execute(
                        text(
                            f"CREATE TABLE IF NOT EXISTS {partition_name} "
                            f"PARTITION OF {base_table} "
                            f"FOR VALUES FROM ('{year}-{month:02d}-01') "
                            f"TO ('{next_year}-{next_month:02d}-01')"
                        )
                    )
                except Exception:
                    pass  # Partition may already exist

    logger.info("Retention cleanup completed")


@app.on_event("startup")
async def on_startup():
    """Start the scheduler on app startup."""
    # Schedule each timeframe as an independent job.
    # This ensures slow/failing timeframes never block others.
    # Stagger initial runs by 10s each to avoid Binance API rate limits on startup.
    for i, (timeframe, config) in enumerate(TIMEFRAME_CONFIG.items()):
        start_date = datetime.now(timezone.utc) + timedelta(seconds=i * 10)
        scheduler.add_job(
            run_timeframe_pipeline,
            trigger=IntervalTrigger(
                minutes=config["cadence_minutes"],
                start_date=start_date,
            ),
            args=[timeframe],
            id=f"pipeline_{timeframe}",
            name=f"Pipeline {timeframe}",
            replace_existing=True,
            max_instances=1,
        )

    # Add retention cleanup (daily at 03:00 UTC)
    scheduler.add_job(
        retention_cleanup,
        trigger=CronTrigger(hour=3, minute=0),
        id="retention_cleanup",
        name="Retention cleanup (90-day partitions)",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        f"Scheduler started with {len(TIMEFRAME_CONFIG)} independent timeframe jobs + daily cleanup"
    )


@app.on_event("shutdown")
async def on_shutdown():
    """Stop the scheduler on app shutdown."""
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.worker_port,
        reload=True,
    )
