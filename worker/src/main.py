"""Alpha Worker entrypoint with FastAPI and APScheduler.

Provides:
- /health — Health check endpoint
- /status — Scheduler status and job list
- /trigger/{timeframe} — Manual pipeline trigger
- Scheduled pipeline runs based on timeframe cadence
"""

import logging
from datetime import datetime, timezone

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI, HTTPException

from src.config import settings
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

# Track last run times for each timeframe
last_runs: dict[str, datetime] = {}


async def scheduled_check():
    """Check which timeframes are due and run their pipelines.

    This runs every 5 minutes and checks each timeframe's cadence.
    """
    now = datetime.now(timezone.utc)
    logger.debug(f"Scheduled check at {now}")

    for timeframe, config in TIMEFRAME_CONFIG.items():
        cadence = config["cadence_minutes"]
        last_run = last_runs.get(timeframe)

        # Check if this timeframe is due
        if last_run is None:
            # First run, check if we're at a cadence boundary
            minutes_since_midnight = now.hour * 60 + now.minute
            if minutes_since_midnight % cadence != 0:
                continue
        else:
            elapsed = (now - last_run).total_seconds() / 60
            if elapsed < cadence:
                continue

        # Run pipeline for this timeframe
        logger.info(f"Running scheduled pipeline for {timeframe}")
        try:
            result = await runner.run(timeframe)
            if result["status"] == "completed":
                last_runs[timeframe] = now
                logger.info(
                    f"Completed {timeframe}: {result.get('symbols', 0)} symbols"
                )
            elif result["status"] == "skipped":
                logger.info(f"Skipped {timeframe}: {result.get('reason')}")
            else:
                logger.error(f"Failed {timeframe}: {result.get('error')}")
        except Exception as e:
            logger.exception(f"Error running pipeline for {timeframe}: {e}")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


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


@app.on_event("startup")
async def on_startup():
    """Start the scheduler on app startup."""
    # Add scheduled check job (runs every 5 minutes)
    scheduler.add_job(
        scheduled_check,
        trigger=IntervalTrigger(minutes=5),
        id="pipeline_check",
        name="Pipeline timeframe check",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started with 5-minute check interval")


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
