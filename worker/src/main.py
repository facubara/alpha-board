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

from src.agents.context import ContextBuilder
from src.agents.orchestrator import AgentOrchestrator
from src.agents.rule_executor import RuleBasedExecutor
from src.config import settings
from src.db import async_session, engine
from src.notifications.digest import send_daily_digest_job
from src.notifications.routes import router as notifications_router
from src.pipeline import TIMEFRAME_CONFIG, PipelineRunner

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Alpha Worker", version="0.1.0")
app.include_router(notifications_router)
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

            # Run agent cycle with market data from pipeline
            if settings.agents_enabled:
                current_prices = result.get("current_prices", {})
                candle_data = result.get("candle_data", {})
                if current_prices:
                    try:
                        async with async_session() as session:
                            orchestrator = AgentOrchestrator(session)
                            await orchestrator.run_cycle(timeframe, current_prices, candle_data)
                    except Exception as e:
                        logger.exception(f"Agent cycle failed for {timeframe}: {e}")

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


@app.get("/debug/agents/{timeframe}")
async def debug_agents(timeframe: str):
    """Diagnostic endpoint for agent execution.

    Runs a dry-run analysis showing:
    - Which agents are found for the timeframe
    - What rankings/indicators they see
    - Which rule thresholds pass or fail
    - The final decision and reasoning

    No trades are executed — this is read-only.
    """
    from decimal import Decimal
    from sqlalchemy import select, func
    from src.models.db import Agent, AgentPortfolio, Snapshot, Symbol

    valid_timeframes = list(TIMEFRAME_CONFIG.keys()) + ["cross"]
    if timeframe not in valid_timeframes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid timeframe. Must be one of: {valid_timeframes}",
        )

    diagnostics: dict = {
        "timeframe": timeframe,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agents": [],
        "errors": [],
    }

    try:
        async with async_session() as session:
            # 1. Find active agents
            result = await session.execute(
                select(Agent).where(
                    Agent.timeframe == timeframe,
                    Agent.status == "active",
                )
            )
            agents = list(result.scalars().all())
            diagnostics["agents_found"] = len(agents)

            if not agents:
                diagnostics["summary"] = f"No active agents for timeframe '{timeframe}'"
                return diagnostics

            # 2. Check latest rankings availability
            if timeframe != "cross":
                subquery = (
                    select(func.max(Snapshot.computed_at))
                    .where(Snapshot.timeframe == timeframe)
                    .scalar_subquery()
                )
                snap_result = await session.execute(
                    select(func.count()).select_from(Snapshot).where(
                        Snapshot.timeframe == timeframe,
                        Snapshot.computed_at == subquery,
                    )
                )
                ranking_count = snap_result.scalar() or 0

                # Get the latest computed_at
                time_result = await session.execute(
                    select(func.max(Snapshot.computed_at)).where(
                        Snapshot.timeframe == timeframe
                    )
                )
                latest_computed = time_result.scalar()

                diagnostics["rankings"] = {
                    "count": ranking_count,
                    "latest_computed_at": latest_computed.isoformat() if latest_computed else None,
                    "age_minutes": round(
                        (datetime.now(timezone.utc) - latest_computed).total_seconds() / 60, 1
                    ) if latest_computed else None,
                }

                if ranking_count == 0:
                    diagnostics["summary"] = (
                        "No ranking snapshots found — pipeline may not have run yet for this timeframe"
                    )
                    return diagnostics

            # 3. Build context and dry-run each agent
            context_builder = ContextBuilder(session)
            rule_executor = RuleBasedExecutor()

            for agent in agents:
                agent_diag: dict = {
                    "id": agent.id,
                    "name": agent.name,
                    "display_name": agent.display_name,
                    "engine": agent.engine,
                    "strategy_archetype": agent.strategy_archetype,
                    "last_cycle_at": agent.last_cycle_at.isoformat() if agent.last_cycle_at else None,
                }

                try:
                    # Portfolio state
                    port_result = await session.execute(
                        select(AgentPortfolio).where(AgentPortfolio.agent_id == agent.id)
                    )
                    portfolio = port_result.scalar_one_or_none()
                    agent_diag["portfolio"] = {
                        "cash_balance": float(portfolio.cash_balance) if portfolio else None,
                        "total_equity": float(portfolio.total_equity) if portfolio else None,
                        "open_positions": None,
                    }

                    # Build full context (same as real orchestrator)
                    context = await context_builder.build(agent, {})

                    agent_diag["portfolio"]["open_positions"] = context.portfolio.position_count
                    agent_diag["portfolio"]["can_open_new"] = (
                        context.portfolio.position_count < 5
                        and context.portfolio.available_for_new_position > 0
                    )
                    agent_diag["portfolio"]["available_for_new_position"] = float(
                        context.portfolio.available_for_new_position
                    )
                    agent_diag["rankings_received"] = len(context.primary_timeframe_rankings)

                    # Show top 5 ranked symbols with key indicator values
                    top_symbols = []
                    for r in context.primary_timeframe_rankings[:5]:
                        sym_info: dict = {
                            "symbol": r.symbol,
                            "rank": r.rank,
                            "bullish_score": r.bullish_score,
                            "confidence": r.confidence,
                            "indicators": {},
                        }

                        # Extract key indicator values for diagnosis
                        for ind_name in [
                            "rsi_14", "macd_12_26_9", "adx_14", "obv",
                            "ema_20", "ema_50", "ema_200",
                            "bb_20", "atr_14",
                        ]:
                            ind = None
                            for sig in r.indicator_signals:
                                if isinstance(sig, dict) and sig.get("name") == ind_name:
                                    ind = sig
                                    break
                            if ind:
                                sym_info["indicators"][ind_name] = {
                                    "signal": ind.get("signal"),
                                    "label": ind.get("label"),
                                    "raw": ind.get("rawValues") or ind.get("raw"),
                                }

                        top_symbols.append(sym_info)

                    agent_diag["top_symbols"] = top_symbols

                    # Run strategy evaluation (dry run)
                    if agent.engine == "rule":
                        try:
                            decision = await rule_executor.decide(
                                context=context,
                                agent_name=agent.name,
                                strategy_archetype=agent.strategy_archetype,
                                prompt_version=1,
                            )
                            agent_diag["decision"] = {
                                "action": decision.action.action.value,
                                "symbol": decision.action.symbol,
                                "position_size_pct": decision.action.position_size_pct,
                                "stop_loss_pct": decision.action.stop_loss_pct,
                                "take_profit_pct": decision.action.take_profit_pct,
                                "confidence": decision.action.confidence,
                                "reasoning": decision.reasoning_summary,
                            }
                        except Exception as e:
                            agent_diag["decision"] = {"error": str(e)}
                    else:
                        agent_diag["decision"] = {
                            "note": "LLM agent — skipping dry-run to avoid API cost"
                        }

                except Exception as e:
                    agent_diag["error"] = str(e)

                diagnostics["agents"].append(agent_diag)

            # Summary
            decisions = [
                a.get("decision", {}).get("action")
                for a in diagnostics["agents"]
                if a.get("decision", {}).get("action")
            ]
            diagnostics["summary"] = {
                "total_agents": len(agents),
                "decisions": {
                    "hold": decisions.count("hold"),
                    "open_long": decisions.count("open_long"),
                    "open_short": decisions.count("open_short"),
                    "close": decisions.count("close"),
                },
                "agents_with_errors": sum(
                    1 for a in diagnostics["agents"] if "error" in a
                ),
            }

    except Exception as e:
        diagnostics["errors"].append(str(e))
        logger.exception(f"Debug agents failed for {timeframe}: {e}")

    return diagnostics


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

    # Add daily digest notification (00:00 UTC)
    scheduler.add_job(
        send_daily_digest_job,
        trigger=CronTrigger(hour=0, minute=0),
        id="daily_digest",
        name="Daily digest notification",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        f"Scheduler started with {len(TIMEFRAME_CONFIG)} independent timeframe jobs + daily cleanup + daily digest"
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
