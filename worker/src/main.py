"""Alpha Worker entrypoint with FastAPI and APScheduler.

Provides:
- /health — Health check endpoint (detailed, for Fly.io checks)
- /status — Scheduler status and job list
- /trigger/{timeframe} — Manual pipeline trigger
- Scheduled pipeline runs based on timeframe cadence
- Daily retention cleanup for old partitions
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy import select, func, text

from src.agents.context import ContextBuilder
from src.agents.orchestrator import AgentOrchestrator
from src.agents.rule_executor import RuleBasedExecutor
from src.cache import cache_delete, get_redis
from src.config import settings
from src.db import async_session, engine
from src.llm_settings import load_llm_settings
from src.events import event_bus
from src.models.db import (
    Agent, AgentPortfolio, AgentPosition, AgentTrade, AgentTokenUsage,
    BacktestRun, BacktestTrade, MemecoinToken, MemecoinTweet,
    MemecoinTweetSignal, MemecoinTweetToken, MemecoinTwitterAccount,
    Snapshot, Symbol, Tweet, TweetSignal, TwitterAccount,
    TokenTracker, TokenTrackerSnapshot,
    WatchWallet, WatchWalletActivity,
)
from src.notifications.digest import send_daily_digest_job
from src.health.routes import router as status_router
from src.notifications.routes import router as notifications_router
from src.pipeline import TIMEFRAME_CONFIG, PipelineRunner, compute_and_persist_regime
from src.exchange.routes import router as exchange_router
from src.sse import router as sse_router

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Alpha Worker", version="0.1.0")

# CORS for SSE connections from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["*"],
)

app.include_router(exchange_router)
app.include_router(notifications_router)
app.include_router(sse_router)
app.include_router(status_router)
scheduler = AsyncIOScheduler()

# Pipeline runner instance
runner = PipelineRunner(
    min_volume_usd=settings.min_volume_usd,
    top_symbols_limit=settings.top_symbols_limit,
)

# Track last run times and results for each timeframe
last_runs: dict[str, datetime] = {}
last_results: dict[str, dict] = {}
start_time = time.monotonic()

# Track running backtest asyncio tasks by run_id
_running_backtest_tasks: dict[int, asyncio.Task] = {}

# Track running twitter import tasks
_twitter_import_counter = 0
_running_import_tasks: dict[int, asyncio.Task] = {}
_import_progress: dict[int, dict] = {}


class _DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal values."""

    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


async def _broadcast_ranking_update(timeframe: str) -> None:
    """Query latest rankings for a timeframe and publish to SSE subscribers."""
    try:
        async with async_session() as session:
            # Same query logic as web/src/lib/queries/rankings.ts getTimeframeRankings
            subquery = (
                select(func.max(Snapshot.computed_at))
                .where(Snapshot.timeframe == timeframe)
                .scalar_subquery()
            )
            result = await session.execute(
                select(Snapshot, Symbol)
                .join(Symbol, Symbol.id == Snapshot.symbol_id)
                .where(
                    Snapshot.timeframe == timeframe,
                    Snapshot.computed_at == subquery,
                )
                .order_by(Snapshot.rank.asc())
            )
            rows = result.all()

            if not rows:
                return

            computed_at = rows[0][0].computed_at.isoformat()
            rankings = []
            for snap, sym in rows:
                # Build indicator_signals in the same camelCase format as the frontend
                indicator_signals = []
                if snap.indicator_signals:
                    for name, data in snap.indicator_signals.items():
                        indicator_signals.append({
                            "name": name,
                            "displayName": name.replace("_", " ").title(),
                            "signal": float(data.get("signal", 0)),
                            "label": data.get("label", "neutral"),
                            "description": str(data.get("label", "neutral")),
                            "rawValues": data.get("raw", {}),
                        })

                rankings.append({
                    "id": snap.id,
                    "symbol": sym.symbol,
                    "symbolId": sym.id,
                    "baseAsset": sym.base_asset,
                    "quoteAsset": sym.quote_asset,
                    "timeframe": snap.timeframe,
                    "bullishScore": float(snap.bullish_score),
                    "confidence": int(snap.confidence),
                    "rank": int(snap.rank),
                    "highlights": snap.highlights or [],
                    "indicatorSignals": indicator_signals,
                    "computedAt": snap.computed_at.isoformat(),
                    "runId": str(snap.run_id),
                })

            await event_bus.publish("rankings", {
                "type": "ranking_update",
                "timeframe": timeframe,
                "rankings": rankings,
                "computedAt": computed_at,
            })
            logger.info(f"Broadcast ranking update for {timeframe}: {len(rankings)} symbols")
    except Exception as e:
        logger.exception(f"Failed to broadcast ranking update for {timeframe}: {e}")


async def _fetch_live_prices() -> dict[str, Decimal]:
    """Fetch current prices from Binance. Cached briefly to avoid redundant calls."""
    try:
        from src.exchange.client import BinanceClient
        client = BinanceClient()
        return await client.get_ticker_prices()
    except Exception as e:
        logger.warning(f"Failed to fetch live prices from Binance: {e}")
        return {}


async def _broadcast_agent_update() -> None:
    """Query agent leaderboard with live PnL and publish to SSE subscribers."""
    try:
        # Fetch live prices from Binance for unrealized PnL calculation
        live_prices = await _fetch_live_prices()

        async with async_session() as session:
            # Get all agents with portfolios
            result = await session.execute(
                select(Agent, AgentPortfolio)
                .join(AgentPortfolio, AgentPortfolio.agent_id == Agent.id)
            )
            rows = result.all()

            # Get all open positions with their symbols in one query
            pos_result = await session.execute(
                select(AgentPosition, Symbol)
                .join(Symbol, Symbol.id == AgentPosition.symbol_id)
            )
            all_positions = pos_result.all()

            # Group positions by agent_id
            positions_by_agent: dict[int, list[tuple]] = {}
            for pos, sym in all_positions:
                positions_by_agent.setdefault(pos.agent_id, []).append((pos, sym))

            agents = []
            for agent, portfolio in rows:
                # Count trades and wins
                trade_result = await session.execute(
                    select(
                        func.count().label("total"),
                        func.count().filter(AgentTrade.pnl > 0).label("wins"),
                    ).where(AgentTrade.agent_id == agent.id)
                )
                trade_row = trade_result.first()
                trade_count = trade_row[0] if trade_row else 0
                wins = trade_row[1] if trade_row else 0

                # Token cost
                cost_result = await session.execute(
                    select(func.coalesce(func.sum(AgentTokenUsage.estimated_cost_usd), 0))
                    .where(AgentTokenUsage.agent_id == agent.id)
                )
                total_token_cost = float(cost_result.scalar() or 0)

                # Calculate live unrealized PnL from open positions + current prices
                agent_positions = positions_by_agent.get(agent.id, [])
                live_unrealized_pnl = Decimal("0")
                for pos, sym in agent_positions:
                    current_price = live_prices.get(sym.symbol)
                    if current_price and pos.entry_price > 0:
                        if pos.direction == "long":
                            pnl = pos.position_size * (current_price - pos.entry_price) / pos.entry_price
                        else:
                            pnl = pos.position_size * (pos.entry_price - current_price) / pos.entry_price
                        live_unrealized_pnl += pnl

                # Live equity = cash + sum of (position_size + unrealized_pnl)
                positions_value = sum(
                    float(pos.position_size) for pos, _ in agent_positions
                )
                live_equity = float(portfolio.cash_balance) + positions_value + float(live_unrealized_pnl)
                live_pnl = live_equity - float(agent.initial_balance)

                realized_pnl = float(portfolio.total_realized_pnl)
                unrealized_pnl = round(live_pnl - realized_pnl, 2)

                agents.append({
                    "id": agent.id,
                    "uuid": str(agent.uuid) if hasattr(agent, "uuid") and agent.uuid else None,
                    "name": agent.name,
                    "displayName": agent.display_name,
                    "strategyArchetype": agent.strategy_archetype,
                    "timeframe": agent.timeframe,
                    "engine": agent.engine or "llm",
                    "scanModel": agent.scan_model,
                    "tradeModel": agent.trade_model,
                    "evolutionModel": agent.evolution_model,
                    "status": agent.status,
                    "initialBalance": float(agent.initial_balance),
                    "cashBalance": float(portfolio.cash_balance),
                    "totalEquity": round(live_equity, 2),
                    "totalRealizedPnl": realized_pnl,
                    "unrealizedPnl": unrealized_pnl,
                    "totalFeesPaid": float(portfolio.total_fees_paid),
                    "totalPnl": round(live_pnl, 2),
                    "tradeCount": trade_count,
                    "wins": wins,
                    "winRate": wins / trade_count if trade_count > 0 else 0,
                    "totalTokenCost": total_token_cost,
                    "openPositions": len(agent_positions),
                    "lastCycleAt": agent.last_cycle_at.isoformat() if agent.last_cycle_at else None,
                })

            # Sort by live PnL descending (best performers first)
            agents.sort(key=lambda a: a["totalPnl"], reverse=True)

            await event_bus.publish("agents", {
                "type": "agent_update",
                "agents": agents,
            })
            logger.debug(f"Broadcast agent update: {len(agents)} agents")
    except Exception as e:
        logger.exception(f"Failed to broadcast agent update: {e}")


async def _broadcast_consensus() -> None:
    """Query open positions grouped by symbol/source/direction and publish consensus to SSE."""
    try:
        async with async_session() as session:
            # Query 1: open positions grouped by symbol/source/direction
            result = await session.execute(
                select(
                    Symbol.symbol,
                    Agent.source,
                    AgentPosition.direction,
                    func.count().label("agent_count"),
                )
                .join(Agent, Agent.id == AgentPosition.agent_id)
                .join(Symbol, Symbol.id == AgentPosition.symbol_id)
                .where(Agent.status == "active")
                .group_by(Symbol.symbol, Agent.source, AgentPosition.direction)
            )
            rows = result.all()

            # Query 2: total active agents per source (denominator)
            agent_count_result = await session.execute(
                select(Agent.source, func.count().label("agent_count"))
                .where(Agent.status == "active")
                .group_by(Agent.source)
            )
            agent_count_rows = agent_count_result.all()

            agent_counts: dict[str, int] = {}
            total_all_agents = 0
            for source, count in agent_count_rows:
                agent_counts[source] = count
                total_all_agents += count

            # Build lookup: { symbol -> { source -> { long: n, short: n } } }
            lookup: dict[str, dict[str, dict[str, int]]] = {}
            for symbol, source, direction, count in rows:
                lookup.setdefault(symbol, {}).setdefault(source, {"long": 0, "short": 0})
                lookup[symbol][source][direction] += count

            def compute_consensus(filter_sources: list[str] | None) -> list[dict]:
                # Compute total active agents for the filtered sources
                if filter_sources is None:
                    total_active = total_all_agents
                else:
                    total_active = sum(agent_counts.get(s, 0) for s in filter_sources)

                if total_active < 2:
                    return []

                items = []
                for symbol, source_map in lookup.items():
                    total_longs = 0
                    total_shorts = 0
                    for source, counts in source_map.items():
                        if filter_sources is None or source in filter_sources:
                            total_longs += counts["long"]
                            total_shorts += counts["short"]

                    positioned = total_longs + total_shorts
                    if positioned == 0:
                        continue

                    majority = max(total_longs, total_shorts)
                    consensus_pct = round(majority / total_active * 100)
                    if consensus_pct < 50:
                        continue

                    items.append({
                        "symbol": symbol,
                        "direction": "long" if total_longs >= total_shorts else "short",
                        "consensusPct": consensus_pct,
                        "longCount": total_longs,
                        "shortCount": total_shorts,
                        "totalAgents": total_active,
                    })

                items.sort(key=lambda x: x["consensusPct"], reverse=True)
                return items

            await event_bus.publish("consensus", {
                "type": "consensus_update",
                "technical": compute_consensus(["technical"]),
                "tweet": compute_consensus(["tweet"]),
                "mixed": compute_consensus(None),
            })
            logger.debug("Broadcast consensus update")
    except Exception as e:
        logger.exception(f"Failed to broadcast consensus update: {e}")


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

            # Invalidate klines cache for this timeframe so next run gets fresh data
            await cache_delete(f"klines:*:{timeframe}")

            # Compute and persist regime for this timeframe
            try:
                async with async_session() as session:
                    await compute_and_persist_regime(session, timeframe)
            except Exception as e:
                logger.exception(f"Regime computation failed for {timeframe}: {e}")

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

                    # Run cross-TF agents after every pipeline cycle
                    try:
                        async with async_session() as session:
                            cross_orchestrator = AgentOrchestrator(session)
                            await cross_orchestrator.run_cycle("cross", current_prices, candle_data)
                    except Exception as e:
                        logger.exception(f"Cross-TF agent cycle failed after {timeframe}: {e}")

            # Broadcast updates to SSE subscribers
            await _broadcast_ranking_update(timeframe)
            await _broadcast_agent_update()
            await _broadcast_consensus()

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

    # Cache connectivity check
    cache_status = "disabled"
    if settings.redis_url:
        try:
            r = await get_redis()
            if r:
                await r.ping()
                info = await r.info("memory")
                cache_status = {
                    "status": "ok",
                    "memory_used": info.get("used_memory_human"),
                }
        except Exception:
            cache_status = "error"

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

    # Twitter stats
    twitter_stats: dict = {
        "enabled": settings.twitter_polling_enabled,
        "accounts_tracked": 0,
        "last_poll": last_twitter_poll.isoformat() if last_twitter_poll else None,
        "tweets_24h": 0,
    }
    try:
        async with engine.connect() as conn:
            acct_row = await conn.execute(
                text("SELECT COUNT(*) FROM twitter_accounts WHERE is_active = true")
            )
            twitter_stats["accounts_tracked"] = acct_row.scalar() or 0

            tweets_row = await conn.execute(
                text(
                    "SELECT COUNT(*) FROM tweets "
                    "WHERE created_at > NOW() - INTERVAL '24 hours'"
                )
            )
            twitter_stats["tweets_24h"] = tweets_row.scalar() or 0
    except Exception:
        pass

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "uptime_seconds": uptime_seconds,
        "db_connection": db_status,
        "cache": cache_status,
        "last_runs": {
            tf: {
                "finished_at": str(last_runs[tf]) if tf in last_runs else None,
                "symbols": last_results.get(tf, {}).get("symbols"),
            }
            for tf in TIMEFRAME_CONFIG
        },
        "agents": agent_stats,
        "twitter": twitter_stats,
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


# =============================================================================
# Backtest Endpoints
# =============================================================================


class BacktestRequest(PydanticBaseModel):
    """Request body for creating a backtest."""

    strategy: str
    timeframe: str
    symbol: str
    start_date: str  # ISO date or datetime string
    end_date: str
    initial_balance: float = 10000.0


async def _run_backtest(run_id: int, config_dict: dict) -> None:
    """Background task that executes a backtest."""
    from src.backtest.engine import BacktestEngine, BacktestConfig

    config = BacktestConfig(**config_dict)
    bt_engine = BacktestEngine()

    async with async_session() as session:
        await bt_engine.run(config, session, run_id=run_id)


@app.post("/backtest")
async def create_backtest(request: BacktestRequest):
    """Launch a backtest as a background task. Returns run_id immediately."""
    from src.agents.strategies import STRATEGY_REGISTRY

    if request.strategy not in STRATEGY_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown strategy. Must be one of: {list(STRATEGY_REGISTRY.keys())}",
        )

    valid_timeframes = ["15m", "30m", "1h", "4h", "1d", "1w"]
    if request.timeframe not in valid_timeframes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid timeframe. Must be one of: {valid_timeframes}",
        )

    try:
        start_dt = datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(request.end_date.replace("Z", "+00:00"))
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")

    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    # Create pending run row
    async with async_session() as session:
        run = BacktestRun(
            agent_name=f"bt-{request.strategy}",
            strategy_archetype=request.strategy,
            timeframe=request.timeframe,
            symbol=request.symbol.upper(),
            start_date=start_dt,
            end_date=end_dt,
            initial_balance=Decimal(str(request.initial_balance)),
            status="pending",
        )
        session.add(run)
        await session.commit()
        await session.refresh(run)
        run_id = run.id

    config_dict = {
        "strategy": request.strategy,
        "timeframe": request.timeframe,
        "symbol": request.symbol.upper(),
        "start_date": start_dt,
        "end_date": end_dt,
        "initial_balance": request.initial_balance,
    }

    task = asyncio.create_task(_run_backtest(run_id, config_dict))
    _running_backtest_tasks[run_id] = task
    task.add_done_callback(lambda t: _running_backtest_tasks.pop(run_id, None))

    return {"run_id": run_id, "status": "pending"}


@app.post("/backtest/{run_id}/cancel")
async def cancel_backtest(run_id: int):
    """Cancel a running backtest."""
    task = _running_backtest_tasks.get(run_id)
    if not task:
        # Check if it exists in DB but no running task (worker restarted?)
        async with async_session() as session:
            result = await session.execute(
                select(BacktestRun).where(BacktestRun.id == run_id)
            )
            run = result.scalar_one_or_none()
            if not run:
                raise HTTPException(404, "Backtest not found")
            if run.status in ("completed", "failed", "cancelled"):
                return {"status": run.status, "message": "Already finished"}
            # Mark as cancelled in DB if no running task
            run.status = "cancelled"
            run.error_message = "Cancelled by user"
            run.completed_at = datetime.now(timezone.utc)
            await session.commit()
            return {"status": "cancelled"}

    task.cancel()
    # Wait briefly for cancellation to propagate
    try:
        await asyncio.wait_for(asyncio.shield(task), timeout=5.0)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        pass
    return {"status": "cancelled"}


@app.get("/backtest")
async def list_backtests():
    """List all backtest runs, most recent first."""
    async with async_session() as session:
        result = await session.execute(
            select(BacktestRun)
            .order_by(BacktestRun.started_at.desc())
            .limit(50)
        )
        runs = result.scalars().all()

        return [
            {
                "id": r.id,
                "agent_name": r.agent_name,
                "strategy_archetype": r.strategy_archetype,
                "timeframe": r.timeframe,
                "symbol": r.symbol,
                "start_date": r.start_date.isoformat(),
                "end_date": r.end_date.isoformat(),
                "initial_balance": float(r.initial_balance),
                "final_equity": float(r.final_equity) if r.final_equity is not None else None,
                "total_pnl": float(r.total_pnl) if r.total_pnl is not None else None,
                "total_trades": r.total_trades,
                "winning_trades": r.winning_trades,
                "max_drawdown_pct": float(r.max_drawdown_pct) if r.max_drawdown_pct is not None else None,
                "sharpe_ratio": float(r.sharpe_ratio) if r.sharpe_ratio is not None else None,
                "status": r.status,
                "error_message": r.error_message,
                "started_at": r.started_at.isoformat(),
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in runs
        ]


@app.get("/backtest/{run_id}")
async def get_backtest(run_id: int):
    """Get full backtest result including trades and equity curve."""
    async with async_session() as session:
        result = await session.execute(
            select(BacktestRun).where(BacktestRun.id == run_id)
        )
        run = result.scalar_one_or_none()

        if not run:
            raise HTTPException(status_code=404, detail="Backtest run not found")

        # Fetch trades
        trades_result = await session.execute(
            select(BacktestTrade)
            .where(BacktestTrade.run_id == run_id)
            .order_by(BacktestTrade.entry_at)
        )
        trades = trades_result.scalars().all()

        return {
            "id": run.id,
            "agent_name": run.agent_name,
            "strategy_archetype": run.strategy_archetype,
            "timeframe": run.timeframe,
            "symbol": run.symbol,
            "start_date": run.start_date.isoformat(),
            "end_date": run.end_date.isoformat(),
            "initial_balance": float(run.initial_balance),
            "final_equity": float(run.final_equity) if run.final_equity is not None else None,
            "total_pnl": float(run.total_pnl) if run.total_pnl is not None else None,
            "total_trades": run.total_trades,
            "winning_trades": run.winning_trades,
            "max_drawdown_pct": float(run.max_drawdown_pct) if run.max_drawdown_pct is not None else None,
            "sharpe_ratio": float(run.sharpe_ratio) if run.sharpe_ratio is not None else None,
            "equity_curve": run.equity_curve,
            "status": run.status,
            "error_message": run.error_message,
            "started_at": run.started_at.isoformat(),
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "trades": [
                {
                    "id": t.id,
                    "symbol": t.symbol,
                    "direction": t.direction,
                    "entry_price": float(t.entry_price),
                    "exit_price": float(t.exit_price),
                    "position_size": float(t.position_size),
                    "pnl": float(t.pnl),
                    "fees": float(t.fees),
                    "exit_reason": t.exit_reason,
                    "entry_at": t.entry_at.isoformat(),
                    "exit_at": t.exit_at.isoformat(),
                    "duration_minutes": t.duration_minutes,
                }
                for t in trades
            ],
        }


# =============================================================================
# Twitter Endpoints
# =============================================================================


class TwitterAccountRequest(PydanticBaseModel):
    """Request body for adding a Twitter account."""

    handle: str
    display_name: str
    category: str


last_twitter_poll: datetime | None = None


async def run_twitter_poll():
    """Scheduled job: poll X API for new tweets from tracked accounts."""
    global last_twitter_poll
    from src.twitter.poller import TwitterPoller

    logger.info("Running Twitter poll")
    try:
        async with async_session() as session:
            await load_llm_settings(session)
            poller = TwitterPoller(session)
            result = await poller.poll()
            last_twitter_poll = datetime.now(timezone.utc)
            logger.info(f"Twitter poll complete: {result}")
    except Exception as e:
        logger.exception(f"Twitter poll failed: {e}")
        return

    # Run tweet agents after poll completes
    if settings.tweet_agents_enabled:
        try:
            current_prices = await _fetch_live_prices()
            if current_prices:
                for tf in ["15m", "30m", "1h", "4h", "1d", "1w"]:
                    try:
                        async with async_session() as session:
                            orchestrator = AgentOrchestrator(session)
                            await orchestrator.run_tweet_cycle(tf, current_prices)
                    except Exception as e:
                        logger.exception(f"Tweet agent cycle failed for {tf}: {e}")

                # Broadcast updated leaderboard and consensus after tweet agents run
                await _broadcast_agent_update()
                await _broadcast_consensus()
        except Exception as e:
            logger.exception(f"Tweet agent execution failed: {e}")


@app.get("/twitter/accounts")
async def list_twitter_accounts():
    """List all tracked Twitter accounts."""
    async with async_session() as session:
        result = await session.execute(
            select(TwitterAccount).order_by(TwitterAccount.added_at.desc())
        )
        accounts = result.scalars().all()

        account_list = []
        for a in accounts:
            # Count tweets per account
            tweet_count_result = await session.execute(
                select(func.count()).select_from(Tweet).where(
                    Tweet.twitter_account_id == a.id
                )
            )
            tweet_count = tweet_count_result.scalar() or 0

            account_list.append({
                "id": a.id,
                "handle": a.handle,
                "displayName": a.display_name,
                "category": a.category,
                "isActive": a.is_active,
                "addedAt": a.added_at.isoformat(),
                "tweetCount": tweet_count,
            })

        return account_list


@app.post("/twitter/accounts")
async def add_twitter_account(request: TwitterAccountRequest):
    """Add a new Twitter account to track."""
    valid_categories = ["analyst", "founder", "news", "degen", "insider", "protocol"]
    if request.category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {valid_categories}",
        )

    handle = request.handle.lstrip("@").lower()
    if not handle or len(handle) > 30:
        raise HTTPException(status_code=400, detail="Invalid handle")

    async with async_session() as session:
        # Check for duplicate
        existing = await session.execute(
            select(TwitterAccount).where(TwitterAccount.handle == handle)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Account already tracked")

        account = TwitterAccount(
            handle=handle,
            display_name=request.display_name,
            category=request.category,
        )
        session.add(account)
        await session.commit()
        await session.refresh(account)

        return {
            "id": account.id,
            "handle": account.handle,
            "displayName": account.display_name,
            "category": account.category,
            "isActive": account.is_active,
            "addedAt": account.added_at.isoformat(),
        }


@app.delete("/twitter/accounts/{account_id}")
async def delete_twitter_account(account_id: int):
    """Remove a tracked Twitter account."""
    async with async_session() as session:
        result = await session.execute(
            select(TwitterAccount).where(TwitterAccount.id == account_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        await session.delete(account)
        await session.commit()
        return {"status": "deleted", "id": account_id}


# ── Twitter following import ─────────────────────────────────────────────

import re
import httpx

_MEMECOIN_KEYWORDS = [
    "memecoin", "meme coin", "degen", "ape", "pump", "moon", "shitcoin",
    "100x", "1000x", "gem", "call group", "alpha calls", "nfa",
    "solana degen", "sol degen", "ct degen", "rug", "airdrop hunter",
]
_MEMECOIN_PATTERN = re.compile(
    "|".join(re.escape(kw) for kw in _MEMECOIN_KEYWORDS),
    re.IGNORECASE,
)


class TwitterImportRequest(PydanticBaseModel):
    account_ids: list[str]


def _classify_user(user: dict) -> tuple[str, str | None]:
    """Classify a Twitter user. Returns (table, category) where table is
    'twitter' for twitter_accounts, 'memecoin' for memecoin_twitter_accounts,
    or 'discard' for skip. category is the DB category value."""
    followers = user.get("public_metrics", {}).get("followers_count", 0)
    if followers < 400:
        return "discard", None
    text = f"{user.get('name', '')} {user.get('description', '')}"
    if _MEMECOIN_PATTERN.search(text):
        return "memecoin", "degen"
    return "twitter", "analyst"


_GRAPHQL_USER_BY_ID = "https://x.com/i/api/graphql/xc8f1g7BYqr6VTzTbvNLGw/UserByRestId"
_GRAPHQL_FEATURES = json.dumps({
    "hidden_profile_subscriptions_enabled": True,
    "rweb_tipjar_consumption_enabled": True,
    "responsive_web_graphql_exclude_directive_enabled": True,
    "verified_phone_label_enabled": False,
    "highlights_tweets_tab_ui_enabled": True,
    "responsive_web_twitter_article_notes_tab_enabled": True,
    "subscriptions_feature_can_gift_premium": True,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "responsive_web_graphql_timeline_navigation_enabled": True,
})


def _graphql_parse_user(data: dict) -> dict | None:
    """Parse GraphQL UserByRestId response into a normalized user dict."""
    try:
        result = data["data"]["user"]["result"]
        if result.get("__typename") == "UserUnavailable":
            return None
        legacy = result.get("legacy", {})
        return {
            "id": result["rest_id"],
            "username": legacy.get("screen_name", ""),
            "name": legacy.get("name", ""),
            "description": legacy.get("description", ""),
            "public_metrics": {
                "followers_count": legacy.get("followers_count", 0),
                "following_count": legacy.get("friends_count", 0),
                "tweet_count": legacy.get("statuses_count", 0),
            },
        }
    except (KeyError, TypeError):
        return None


async def _insert_user(session, user: dict, progress: dict):
    """Classify and insert a single user into the appropriate table."""
    handle = user.get("username", "")
    if not handle:
        progress["errors"] += 1
        return

    table, category = _classify_user(user)

    if table == "discard":
        progress["skipped_discard"] += 1
        return

    display_name = user.get("name", handle)
    followers = user.get("public_metrics", {}).get("followers_count")
    bio = user.get("description", "") or None

    if table == "memecoin":
        existing = await session.execute(
            select(MemecoinTwitterAccount).where(
                MemecoinTwitterAccount.handle == handle
            )
        )
        row = existing.scalar_one_or_none()
        if row:
            if row.followers_count is None and followers is not None:
                row.followers_count = followers
                row.bio = bio
            progress["skipped_existing"] += 1
            return
        session.add(MemecoinTwitterAccount(
            handle=handle, display_name=display_name, category=category,
            followers_count=followers, bio=bio,
        ))
    else:
        existing = await session.execute(
            select(TwitterAccount).where(TwitterAccount.handle == handle)
        )
        row = existing.scalar_one_or_none()
        if row:
            if row.followers_count is None and followers is not None:
                row.followers_count = followers
                row.bio = bio
            progress["skipped_existing"] += 1
            return
        session.add(TwitterAccount(
            handle=handle, display_name=display_name, category=category,
            followers_count=followers, bio=bio,
        ))

    progress["inserted"] += 1


async def _run_twitter_import(import_id: int, account_ids: list[str]):
    """Background task: look up Twitter IDs and insert into DB.

    Uses GraphQL (cookie auth, no credit limit) if TWITTER_AUTH_TOKEN + TWITTER_CT0
    are set, otherwise falls back to API v2 (bearer token, credit-limited).
    """
    progress = _import_progress[import_id]
    progress["status"] = "running"

    use_graphql = bool(settings.twitter_auth_token and settings.twitter_ct0)

    if use_graphql:
        await _import_via_graphql(import_id, account_ids, progress)
    else:
        await _import_via_api_v2(import_id, account_ids, progress)


async def _import_via_graphql(import_id: int, account_ids: list[str], progress: dict):
    """Import users one-by-one via Twitter GraphQL (cookie auth, no credit limit)."""
    progress["total_batches"] = len(account_ids)  # 1 user per "batch"

    gql_headers = {
        "Authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
        "Cookie": f"auth_token={settings.twitter_auth_token}; ct0={settings.twitter_ct0}",
        "X-Csrf-Token": settings.twitter_ct0,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "X-Twitter-Active-User": "yes",
        "X-Twitter-Auth-Type": "OAuth2Session",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for i, user_id in enumerate(account_ids):
                progress["current_batch"] = i + 1

                params = {
                    "variables": json.dumps({"userId": user_id, "withSafetyModeUserFields": True}),
                    "features": _GRAPHQL_FEATURES,
                }

                try:
                    resp = await client.get(_GRAPHQL_USER_BY_ID, headers=gql_headers, params=params)
                except httpx.HTTPError as e:
                    logger.warning(f"GraphQL request error for {user_id}: {e}")
                    progress["errors"] += 1
                    progress["processed"] += 1
                    continue

                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", "60"))
                    progress["rate_limit_wait"] = retry_after
                    logger.warning(f"GraphQL rate limited, waiting {retry_after}s")
                    await asyncio.sleep(retry_after)
                    progress["rate_limit_wait"] = None
                    # Retry this user
                    try:
                        resp = await client.get(_GRAPHQL_USER_BY_ID, headers=gql_headers, params=params)
                    except httpx.HTTPError:
                        progress["errors"] += 1
                        progress["processed"] += 1
                        continue

                if resp.status_code == 403:
                    progress["status"] = "failed"
                    progress["error_message"] = "Auth expired (403). Update TWITTER_AUTH_TOKEN and TWITTER_CT0."
                    logger.error("GraphQL auth expired (403)")
                    return

                if resp.status_code != 200:
                    progress["errors"] += 1
                    progress["processed"] += 1
                    continue

                user = _graphql_parse_user(resp.json())
                if not user:
                    progress["errors"] += 1
                    progress["processed"] += 1
                    continue

                async with async_session() as session:
                    await _insert_user(session, user, progress)
                    await session.commit()

                progress["processed"] += 1

                # Delay to avoid rate limiting (~500 req/15min)
                await asyncio.sleep(1.2)

        progress["status"] = "completed"
    except Exception as e:
        logger.exception(f"Twitter import {import_id} failed")
        progress["status"] = "failed"
        progress["error_message"] = str(e)


async def _import_via_api_v2(import_id: int, account_ids: list[str], progress: dict):
    """Import users in batches via Twitter API v2 (bearer token, credit-limited)."""
    bearer = settings.twitter_bearer_token
    url = "https://api.twitter.com/2/users"
    headers = {"Authorization": f"Bearer {bearer}"}
    fields = "name,username,description,public_metrics"

    batches = [account_ids[i:i + 100] for i in range(0, len(account_ids), 100)]
    progress["total_batches"] = len(batches)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for batch_idx, batch in enumerate(batches):
                progress["current_batch"] = batch_idx + 1
                retries = 0

                while retries < 3:
                    resp = await client.get(
                        url,
                        headers=headers,
                        params={"ids": ",".join(batch), "user.fields": fields},
                    )

                    if resp.status_code in (429, 402):
                        retry_after = int(resp.headers.get("Retry-After", "60"))
                        progress["rate_limit_wait"] = retry_after
                        logger.warning(f"API v2 rate limited ({resp.status_code}), waiting {retry_after}s")
                        await asyncio.sleep(retry_after)
                        progress["rate_limit_wait"] = None
                        retries += 1
                        continue

                    if resp.status_code >= 500:
                        wait = 2 ** retries
                        logger.warning(f"Twitter API 5xx ({resp.status_code}), retry in {wait}s")
                        await asyncio.sleep(wait)
                        retries += 1
                        continue

                    break
                else:
                    progress["errors"] += len(batch)
                    progress["processed"] += len(batch)
                    progress["error_message"] = "Rate limit exhausted after retries"
                    progress["status"] = "failed"
                    return

                if resp.status_code != 200:
                    progress["errors"] += len(batch)
                    progress["processed"] += len(batch)
                    try:
                        detail = resp.json()
                    except Exception:
                        detail = resp.text[:200]
                    msg = f"HTTP {resp.status_code}: {detail}"
                    logger.error(f"Twitter import batch failed: {msg}")
                    progress["error_message"] = msg
                    if resp.status_code in (401, 403):
                        progress["status"] = "failed"
                        return
                    continue

                body = resp.json()
                users = body.get("data", [])
                api_errors = body.get("errors", [])
                progress["errors"] += len(api_errors)

                async with async_session() as session:
                    for user in users:
                        await _insert_user(session, user, progress)
                    await session.commit()

                progress["processed"] += len(batch)

        progress["status"] = "completed"
    except Exception as e:
        logger.exception(f"Twitter import {import_id} failed")
        progress["status"] = "failed"
        progress["error_message"] = str(e)


@app.post("/twitter/import")
async def start_twitter_import(request: TwitterImportRequest):
    """Start a bulk import of Twitter accounts by ID."""
    has_graphql = bool(settings.twitter_auth_token and settings.twitter_ct0)
    has_bearer = bool(settings.twitter_bearer_token)
    if not has_graphql and not has_bearer:
        raise HTTPException(
            status_code=400,
            detail="No Twitter auth configured. Set TWITTER_AUTH_TOKEN + TWITTER_CT0 (preferred) or TWITTER_BEARER_TOKEN.",
        )

    if not request.account_ids:
        raise HTTPException(status_code=400, detail="No account IDs provided")

    global _twitter_import_counter
    _twitter_import_counter += 1
    import_id = _twitter_import_counter

    _import_progress[import_id] = {
        "import_id": import_id,
        "status": "pending",
        "total_accounts": len(request.account_ids),
        "processed": 0,
        "inserted": 0,
        "skipped_existing": 0,
        "skipped_discard": 0,
        "errors": 0,
        "current_batch": 0,
        "total_batches": 0,
        "rate_limit_wait": None,
        "error_message": None,
    }

    task = asyncio.create_task(_run_twitter_import(import_id, request.account_ids))
    _running_import_tasks[import_id] = task
    task.add_done_callback(lambda t: _running_import_tasks.pop(import_id, None))

    return {"import_id": import_id, "status": "pending"}


@app.get("/twitter/import/{import_id}")
async def get_twitter_import_progress(import_id: int):
    """Get progress of a twitter import task."""
    progress = _import_progress.get(import_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Import not found")
    return progress


@app.get("/twitter/feed")
async def twitter_feed(limit: int = 50, offset: int = 0):
    """Get recent tweets with signal data, paginated."""
    limit = min(limit, 200)
    async with async_session() as session:
        result = await session.execute(
            select(Tweet, TwitterAccount, TweetSignal)
            .join(TwitterAccount, TwitterAccount.id == Tweet.twitter_account_id)
            .outerjoin(TweetSignal, TweetSignal.tweet_id == Tweet.id)
            .order_by(Tweet.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = result.all()

        feed = []
        for tweet, account, signal in rows:
            item = {
                "id": tweet.id,
                "tweetId": tweet.tweet_id,
                "accountHandle": account.handle,
                "accountDisplayName": account.display_name,
                "accountCategory": account.category,
                "text": tweet.text,
                "createdAt": tweet.created_at.isoformat(),
                "metrics": tweet.metrics,
                "ingestedAt": tweet.ingested_at.isoformat(),
            }
            if signal:
                item["signal"] = {
                    "sentimentScore": float(signal.sentiment_score),
                    "setupType": signal.setup_type,
                    "confidence": float(signal.confidence),
                    "symbolsMentioned": signal.symbols_mentioned or [],
                    "reasoning": signal.reasoning,
                }
            feed.append(item)

        return feed


@app.post("/twitter/poll")
async def trigger_twitter():
    """Manually trigger a Twitter poll + tweet agents."""
    if not settings.twitter_bearer_token:
        raise HTTPException(status_code=400, detail="Twitter bearer token not configured")

    from src.twitter.poller import TwitterPoller

    async with async_session() as session:
        await load_llm_settings(session)
        poller = TwitterPoller(session)
        result = await poller.poll()

    global last_twitter_poll
    last_twitter_poll = datetime.now(timezone.utc)

    # Run tweet agents after manual poll (same as scheduled poll)
    tweet_results = {}
    if settings.tweet_agents_enabled:
        try:
            current_prices = await _fetch_live_prices()
            if current_prices:
                for tf in ["15m", "30m", "1h", "4h", "1d", "1w"]:
                    try:
                        async with async_session() as session:
                            orchestrator = AgentOrchestrator(session)
                            tf_result = await orchestrator.run_tweet_cycle(tf, current_prices)
                            tweet_results[tf] = {
                                "agents_processed": tf_result["agents_processed"],
                                "executions": len(tf_result["executions"]),
                                "errors": len(tf_result["errors"]),
                            }
                    except Exception as e:
                        tweet_results[tf] = {"error": str(e)}

                await _broadcast_agent_update()
        except Exception as e:
            tweet_results["error"] = str(e)

    result["tweet_agents"] = tweet_results
    return result


@app.post("/twitter/analyze")
async def trigger_tweet_analysis():
    """Manually trigger sentiment analysis on all unanalyzed tweets."""
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=400, detail="Anthropic API key not configured")

    from src.twitter.analyzer import TweetAnalyzer

    async with async_session() as session:
        analyzer = TweetAnalyzer()
        result = await analyzer.analyze_batch(session)

    return result


async def run_pnl_reconciliation():
    """Scheduled job: reconcile PnL for all active agents."""
    from src.agents.portfolio import PortfolioManager

    logger.info("Running PnL reconciliation")
    try:
        async with async_session() as session:
            result = await session.execute(
                select(Agent).where(Agent.status.in_(["active", "paused"]))
            )
            agents = result.scalars().all()
            pm = PortfolioManager(session)
            inconsistencies = []
            for agent in agents:
                report = await pm.reconcile_pnl(agent.id)
                if not report["is_consistent"]:
                    inconsistencies.append({
                        "agent_id": agent.id,
                        "agent_name": agent.name,
                        **report,
                    })
            if inconsistencies:
                logger.warning(f"PnL reconciliation found {len(inconsistencies)} inconsistencies: {inconsistencies}")
            else:
                logger.info(f"PnL reconciliation passed for {len(agents)} agents")
    except Exception as e:
        logger.exception(f"PnL reconciliation failed: {e}")


@app.get("/reconcile")
async def reconcile():
    """Run PnL reconciliation for all agents and return results."""
    from src.agents.portfolio import PortfolioManager

    results = []
    async with async_session() as session:
        result = await session.execute(
            select(Agent).where(Agent.status.in_(["active", "paused"]))
        )
        agents = result.scalars().all()
        pm = PortfolioManager(session)
        for agent in agents:
            report = await pm.reconcile_pnl(agent.id)
            results.append({
                "agent_id": agent.id,
                "agent_name": agent.name,
                **report,
            })
    return {
        "total": len(results),
        "consistent": sum(1 for r in results if r["is_consistent"]),
        "inconsistent": sum(1 for r in results if not r["is_consistent"]),
        "agents": results,
    }


@app.post("/agents/{agent_id}/pause")
async def pause_agent(agent_id: int):
    """Pause an agent, closing all open positions and sending notification."""
    from src.agents.portfolio import PortfolioManager
    from src.notifications.models import AgentPausedEvent
    from src.notifications.service import NotificationService

    async with async_session() as session:
        agent_result = await session.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = agent_result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        if agent.status != "active":
            raise HTTPException(status_code=400, detail=f"Agent is {agent.status}, not active")

        # Fetch live prices
        live_prices = await _fetch_live_prices()

        # Close all positions
        pm = PortfolioManager(session)
        closed = await pm.close_all_positions(agent.id, live_prices)

        total_realized = sum(c.details.get("pnl", 0) for c in closed)

        # Update agent status
        agent.status = "paused"
        await session.commit()

        # Send notification
        try:
            ns = NotificationService(session)
            event = AgentPausedEvent(
                agent_name=agent.name,
                engine=agent.engine,
                agent_id=agent.id,
                agent_uuid=str(agent.uuid) if agent.uuid else "",
                positions_closed=len(closed),
                realized_pnl_from_close=Decimal(str(total_realized)),
            )
            await ns.notify_agent_paused(event)
        except Exception:
            logger.debug(f"Failed to send pause notification for {agent.name}", exc_info=True)

        return {
            "agent_id": agent.id,
            "status": "paused",
            "positions_closed": len(closed),
            "realized_pnl": float(total_realized),
        }


# =============================================================================
# Memecoin Endpoints
# =============================================================================


class MemecoinWalletRequest(PydanticBaseModel):
    """Request body for manually adding a wallet."""
    address: str
    label: str = ""


class MemecoinTokenRequest(PydanticBaseModel):
    """Request body for manually adding a token."""
    mint_address: str


class AnalyzeTokenRequest(PydanticBaseModel):
    """Request body for starting a token analysis."""
    mint_address: str
    num_buyers: int = 50


class CheckTokenRequest(PydanticBaseModel):
    """Request body for cross-reference checking a token."""
    mint_address: str


class MemecoinTwitterAccountRequest(PydanticBaseModel):
    """Request body for adding a memecoin Twitter account."""
    handle: str
    display_name: str
    category: str
    is_vip: bool = False


last_memecoin_twitter_poll: datetime | None = None


async def run_memecoin_twitter_poll():
    """Scheduled job: poll X API for memecoin tweets."""
    global last_memecoin_twitter_poll
    from src.memecoins.twitter_poller import MemecoinTwitterPoller

    logger.info("Running memecoin Twitter poll")
    try:
        async with async_session() as session:
            await load_llm_settings(session)
            poller = MemecoinTwitterPoller(session)
            result = await poller.poll()
            last_memecoin_twitter_poll = datetime.now(timezone.utc)
            logger.info(f"Memecoin Twitter poll complete: {result}")
    except Exception as e:
        logger.exception(f"Memecoin Twitter poll failed: {e}")


@app.get("/memecoins/wallets")
async def list_watch_wallets(limit: int = 50, offset: int = 0):
    """List watch wallets sorted by score."""
    limit = min(limit, 200)
    async with async_session() as session:
        result = await session.execute(
            select(WatchWallet)
            .where(WatchWallet.is_active == True)  # noqa: E712
            .order_by(WatchWallet.score.desc())
            .offset(offset)
            .limit(limit)
        )
        wallets = result.scalars().all()

        return [
            {
                "id": w.id,
                "address": w.address,
                "label": w.label,
                "source": w.source,
                "score": float(w.score),
                "hitCount": w.hit_count,
                "winRate": float(w.win_rate) if w.win_rate else None,
                "avgEntryRank": w.avg_entry_rank,
                "totalTokensTraded": w.total_tokens_traded,
                "tokensSummary": w.tokens_summary,
                "isActive": w.is_active,
                "stats": w.stats,
                "addedAt": w.added_at.isoformat(),
                "lastRefreshedAt": w.last_refreshed_at.isoformat() if w.last_refreshed_at else None,
            }
            for w in wallets
        ]


@app.get("/memecoins/wallets/{address}")
async def get_watch_wallet(address: str):
    """Get single wallet detail with recent activity."""
    async with async_session() as session:
        result = await session.execute(
            select(WatchWallet).where(WatchWallet.address == address)
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(404, "Wallet not found")

        # Get recent activity
        activity_result = await session.execute(
            select(WatchWalletActivity)
            .where(WatchWalletActivity.wallet_id == wallet.id)
            .order_by(WatchWalletActivity.block_time.desc())
            .limit(50)
        )
        activities = activity_result.scalars().all()

        return {
            "id": wallet.id,
            "address": wallet.address,
            "label": wallet.label,
            "source": wallet.source,
            "score": float(wallet.score),
            "hitCount": wallet.hit_count,
            "winRate": float(wallet.win_rate) if wallet.win_rate else None,
            "avgEntryRank": wallet.avg_entry_rank,
            "totalTokensTraded": wallet.total_tokens_traded,
            "tokensSummary": wallet.tokens_summary,
            "isActive": wallet.is_active,
            "stats": wallet.stats,
            "addedAt": wallet.added_at.isoformat(),
            "lastRefreshedAt": wallet.last_refreshed_at.isoformat() if wallet.last_refreshed_at else None,
            "recentActivity": [
                {
                    "id": a.id,
                    "tokenMint": a.token_mint,
                    "tokenSymbol": a.token_symbol,
                    "tokenName": a.token_name,
                    "direction": a.direction,
                    "amountSol": float(a.amount_sol) if a.amount_sol else None,
                    "priceUsd": float(a.price_usd) if a.price_usd else None,
                    "txSignature": a.tx_signature,
                    "blockTime": a.block_time.isoformat(),
                    "detectedAt": a.detected_at.isoformat(),
                }
                for a in activities
            ],
        }


@app.post("/memecoins/wallets")
async def add_watch_wallet(request: MemecoinWalletRequest):
    """Manually add a wallet to watch."""
    address = request.address.strip()
    if not address or len(address) > 64:
        raise HTTPException(400, "Invalid address")

    async with async_session() as session:
        existing = await session.execute(
            select(WatchWallet).where(WatchWallet.address == address)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(409, "Wallet already tracked")

        wallet = WatchWallet(
            address=address,
            label=request.label or None,
            source="manual",
        )
        session.add(wallet)
        await session.commit()
        await session.refresh(wallet)

        return {
            "id": wallet.id,
            "address": wallet.address,
            "label": wallet.label,
            "source": wallet.source,
            "score": float(wallet.score),
            "addedAt": wallet.added_at.isoformat(),
        }


@app.delete("/memecoins/wallets/{address}")
async def delete_watch_wallet(address: str):
    """Remove a watched wallet."""
    async with async_session() as session:
        result = await session.execute(
            select(WatchWallet).where(WatchWallet.address == address)
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(404, "Wallet not found")

        wallet.is_active = False
        await session.commit()
        return {"status": "deactivated", "address": address}


@app.post("/memecoins/wallets/refresh")
async def refresh_wallets():
    """Trigger manual wallet cross-reference refresh."""
    if not settings.helius_api_key:
        raise HTTPException(400, "Helius API key not configured")

    from src.memecoins.wallet_discovery import WalletDiscoveryPipeline

    async with async_session() as session:
        pipeline = WalletDiscoveryPipeline(session)
        result = await pipeline.run()

    return result


@app.get("/memecoins/tokens")
async def list_memecoin_tokens(limit: int = 50):
    """List tracked successful tokens."""
    limit = min(limit, 200)
    async with async_session() as session:
        result = await session.execute(
            select(MemecoinToken)
            .order_by(MemecoinToken.peak_mcap_usd.desc())
            .limit(limit)
        )
        tokens = result.scalars().all()
        return [
            {
                "id": t.id,
                "mintAddress": t.mint_address,
                "name": t.name,
                "symbol": t.symbol,
                "launchpad": t.launchpad,
                "peakMcapUsd": float(t.peak_mcap_usd) if t.peak_mcap_usd else None,
                "currentMcapUsd": float(t.current_mcap_usd) if t.current_mcap_usd else None,
                "status": t.status,
                "createdAt": t.created_at.isoformat(),
            }
            for t in tokens
        ]


@app.post("/memecoins/tokens")
async def add_memecoin_token(request: MemecoinTokenRequest):
    """Manually add a token to track."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    mint = request.mint_address.strip()
    if not mint or len(mint) > 64:
        raise HTTPException(400, "Invalid mint address")

    async with async_session() as session:
        stmt = pg_insert(MemecoinToken).values(
            mint_address=mint,
            status="active",
        ).on_conflict_do_nothing(index_elements=["mint_address"])
        await session.execute(stmt)
        await session.commit()

        result = await session.execute(
            select(MemecoinToken).where(MemecoinToken.mint_address == mint)
        )
        token = result.scalar_one_or_none()
        if not token:
            raise HTTPException(500, "Failed to add token")

        return {
            "id": token.id,
            "mintAddress": token.mint_address,
            "symbol": token.symbol,
            "status": token.status,
        }


@app.get("/memecoins/activity")
async def get_wallet_activity(limit: int = 50):
    """Get recent wallet activity across all watched wallets."""
    limit = min(limit, 200)
    async with async_session() as session:
        result = await session.execute(
            select(WatchWalletActivity, WatchWallet)
            .join(WatchWallet, WatchWallet.id == WatchWalletActivity.wallet_id)
            .order_by(WatchWalletActivity.detected_at.desc())
            .limit(limit)
        )
        rows = result.all()

        return [
            {
                "id": a.id,
                "walletId": a.wallet_id,
                "walletAddress": w.address,
                "walletLabel": w.label,
                "tokenMint": a.token_mint,
                "tokenSymbol": a.token_symbol,
                "tokenName": a.token_name,
                "direction": a.direction,
                "amountSol": float(a.amount_sol) if a.amount_sol else None,
                "priceUsd": float(a.price_usd) if a.price_usd else None,
                "txSignature": a.tx_signature,
                "blockTime": a.block_time.isoformat(),
                "detectedAt": a.detected_at.isoformat(),
            }
            for a, w in rows
        ]


# -- Token Analysis & Cross-Reference Endpoints --


@app.post("/memecoins/analyze")
async def start_token_analysis(request: AnalyzeTokenRequest):
    """Start a new token analysis job."""
    if not settings.helius_api_key:
        raise HTTPException(400, "Helius API key not configured")

    mint = request.mint_address.strip()
    if not mint or len(mint) > 64:
        raise HTTPException(400, "Invalid mint address")

    from src.memecoins.token_analyzer import TokenAnalyzer

    async with async_session() as session:
        analyzer = TokenAnalyzer(session)
        analysis_id = await analyzer.start_analysis(mint, request.num_buyers)
        return {"analysisId": analysis_id, "status": "pending"}


@app.get("/memecoins/analyze/{analysis_id}")
async def get_token_analysis(analysis_id: int):
    """Get analysis job status and results."""
    from src.memecoins.token_analyzer import TokenAnalyzer

    async with async_session() as session:
        analyzer = TokenAnalyzer(session)
        result = await analyzer.get_analysis(analysis_id)
        if not result:
            raise HTTPException(404, "Analysis not found")
        return result


@app.get("/memecoins/analyses")
async def list_token_analyses():
    """List all token analyses."""
    from src.memecoins.token_analyzer import TokenAnalyzer

    async with async_session() as session:
        analyzer = TokenAnalyzer(session)
        return await analyzer.list_analyses()


@app.post("/memecoins/analyze/{analysis_id}/resume")
async def resume_token_analysis(analysis_id: int):
    """Resume a paused or failed analysis."""
    from src.memecoins.token_analyzer import TokenAnalyzer

    async with async_session() as session:
        analyzer = TokenAnalyzer(session)
        try:
            await analyzer.resume_analysis(analysis_id)
            return {"analysisId": analysis_id, "status": "running"}
        except ValueError as e:
            raise HTTPException(400, str(e))


@app.post("/memecoins/check")
async def check_token_cross_reference(request: CheckTokenRequest):
    """Cross-reference a token's buyers against the analyzed wallet database."""
    if not settings.helius_api_key:
        raise HTTPException(400, "Helius API key not configured")

    mint = request.mint_address.strip()
    if not mint or len(mint) > 64:
        raise HTTPException(400, "Invalid mint address")

    from src.memecoins.cross_reference import CrossReferenceChecker

    async with async_session() as session:
        checker = CrossReferenceChecker(session)
        return await checker.check_token(mint)


@app.get("/memecoins/checks")
async def list_cross_reference_checks():
    """List past cross-reference checks."""
    from src.memecoins.cross_reference import CrossReferenceChecker

    async with async_session() as session:
        checker = CrossReferenceChecker(session)
        return await checker.list_checks()


@app.post("/webhooks/helius/wallet-activity")
async def helius_webhook(request_data: list[dict] | dict = []):
    """Helius webhook handler for wallet swap activity. Always returns 200."""
    from src.memecoins.wallet_monitor import WalletMonitor

    events = request_data if isinstance(request_data, list) else [request_data]
    if not events:
        return {"processed": 0}

    try:
        async with async_session() as session:
            monitor = WalletMonitor(session)
            result = await monitor.handle_webhook(events)
            return result
    except Exception as e:
        logger.exception(f"Webhook processing failed: {e}")
        return {"processed": 0, "error": str(e)}


MEMECOIN_TWITTER_CATEGORIES = ["caller", "influencer", "degen", "news"]


@app.get("/memecoins/twitter/accounts")
async def list_memecoin_twitter_accounts():
    """List memecoin twitter accounts."""
    async with async_session() as session:
        result = await session.execute(
            select(MemecoinTwitterAccount).order_by(
                MemecoinTwitterAccount.added_at.desc()
            )
        )
        accounts = result.scalars().all()

        account_list = []
        for a in accounts:
            tweet_count_result = await session.execute(
                select(func.count())
                .select_from(MemecoinTweet)
                .where(MemecoinTweet.account_id == a.id)
            )
            tweet_count = tweet_count_result.scalar() or 0

            account_list.append({
                "id": a.id,
                "handle": a.handle,
                "displayName": a.display_name,
                "category": a.category,
                "isVip": a.is_vip,
                "isActive": a.is_active,
                "addedAt": a.added_at.isoformat(),
                "tweetCount": tweet_count,
            })

        return account_list


@app.post("/memecoins/twitter/accounts")
async def add_memecoin_twitter_account(request: MemecoinTwitterAccountRequest):
    """Add a memecoin Twitter account."""
    if request.category not in MEMECOIN_TWITTER_CATEGORIES:
        raise HTTPException(
            400,
            f"Invalid category. Must be one of: {MEMECOIN_TWITTER_CATEGORIES}",
        )

    handle = request.handle.lstrip("@").lower()
    if not handle or len(handle) > 30:
        raise HTTPException(400, "Invalid handle")

    async with async_session() as session:
        existing = await session.execute(
            select(MemecoinTwitterAccount).where(
                MemecoinTwitterAccount.handle == handle
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(409, "Account already tracked")

        account = MemecoinTwitterAccount(
            handle=handle,
            display_name=request.display_name,
            category=request.category,
            is_vip=request.is_vip,
        )
        session.add(account)
        await session.commit()
        await session.refresh(account)

        return {
            "id": account.id,
            "handle": account.handle,
            "displayName": account.display_name,
            "category": account.category,
            "isVip": account.is_vip,
            "isActive": account.is_active,
            "addedAt": account.added_at.isoformat(),
        }


@app.delete("/memecoins/twitter/accounts/{account_id}")
async def delete_memecoin_twitter_account(account_id: int):
    """Remove a memecoin Twitter account."""
    async with async_session() as session:
        result = await session.execute(
            select(MemecoinTwitterAccount).where(
                MemecoinTwitterAccount.id == account_id
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(404, "Account not found")

        await session.delete(account)
        await session.commit()
        return {"status": "deleted", "id": account_id}


@app.patch("/memecoins/twitter/accounts/{account_id}")
async def toggle_memecoin_vip(account_id: int):
    """Toggle VIP status for a memecoin Twitter account."""
    async with async_session() as session:
        result = await session.execute(
            select(MemecoinTwitterAccount).where(
                MemecoinTwitterAccount.id == account_id
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(404, "Account not found")

        account.is_vip = not account.is_vip
        await session.commit()

        return {
            "id": account.id,
            "handle": account.handle,
            "isVip": account.is_vip,
        }


@app.get("/memecoins/twitter/feed")
async def memecoin_twitter_feed(limit: int = 50, offset: int = 0):
    """Get recent memecoin tweets with token matches and signals."""
    limit = min(limit, 200)
    async with async_session() as session:
        result = await session.execute(
            select(MemecoinTweet, MemecoinTwitterAccount, MemecoinTweetSignal)
            .join(
                MemecoinTwitterAccount,
                MemecoinTwitterAccount.id == MemecoinTweet.account_id,
            )
            .outerjoin(
                MemecoinTweetSignal,
                MemecoinTweetSignal.tweet_id == MemecoinTweet.id,
            )
            .order_by(MemecoinTweet.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = result.all()

        feed = []
        for tweet, account, signal in rows:
            # Fetch token matches for this tweet
            token_result = await session.execute(
                select(MemecoinTweetToken).where(
                    MemecoinTweetToken.tweet_id == tweet.id
                )
            )
            token_matches = token_result.scalars().all()

            item = {
                "id": tweet.id,
                "tweetId": tweet.tweet_id,
                "accountHandle": account.handle,
                "accountDisplayName": account.display_name,
                "accountCategory": account.category,
                "isVip": account.is_vip,
                "text": tweet.text,
                "createdAt": tweet.created_at.isoformat(),
                "metrics": tweet.metrics,
                "ingestedAt": tweet.ingested_at.isoformat(),
                "tokenMatches": [
                    {
                        "id": tm.id,
                        "tokenMint": tm.token_mint,
                        "tokenSymbol": tm.token_symbol,
                        "tokenName": tm.token_name,
                        "source": tm.source,
                        "dexscreenerUrl": tm.dexscreener_url,
                        "marketCapUsd": float(tm.market_cap_usd) if tm.market_cap_usd else None,
                        "priceUsd": float(tm.price_usd) if tm.price_usd else None,
                        "liquidityUsd": float(tm.liquidity_usd) if tm.liquidity_usd else None,
                        "matchedAt": tm.matched_at.isoformat(),
                    }
                    for tm in token_matches
                ],
            }

            if signal:
                item["signal"] = {
                    "sentimentScore": float(signal.sentiment_score),
                    "setupType": signal.setup_type,
                    "confidence": float(signal.confidence),
                    "symbolsMentioned": signal.symbols_mentioned or [],
                    "reasoning": signal.reasoning,
                }

            feed.append(item)

        return feed


# =============================================================================
# Token Tracker Endpoints
# =============================================================================


class TokenTrackerAddRequest(PydanticBaseModel):
    """Request body for adding a token to the tracker."""
    mint_address: str
    refresh_interval_minutes: int = 15


class TokenTrackerUpdateRequest(PydanticBaseModel):
    """Request body for updating a tracked token."""
    refresh_interval_minutes: int


@app.get("/memecoins/tracker")
async def list_tracked_tokens():
    """List all active tracked tokens."""
    async with async_session() as session:
        result = await session.execute(
            select(TokenTracker)
            .where(TokenTracker.is_active == True)  # noqa: E712
            .order_by(TokenTracker.added_at.desc())
        )
        tokens = result.scalars().all()

        return [
            {
                "id": t.id,
                "mintAddress": t.mint_address,
                "symbol": t.symbol,
                "name": t.name,
                "source": t.source,
                "refreshIntervalMinutes": t.refresh_interval_minutes,
                "isActive": t.is_active,
                "latestHolders": t.latest_holders,
                "latestPriceUsd": float(t.latest_price_usd) if t.latest_price_usd else None,
                "latestVolume24hUsd": float(t.latest_volume_24h_usd) if t.latest_volume_24h_usd else None,
                "latestMcapUsd": float(t.latest_mcap_usd) if t.latest_mcap_usd else None,
                "latestLiquidityUsd": float(t.latest_liquidity_usd) if t.latest_liquidity_usd else None,
                "lastRefreshedAt": t.last_refreshed_at.isoformat() if t.last_refreshed_at else None,
                "addedAt": t.added_at.isoformat(),
            }
            for t in tokens
        ]


@app.post("/memecoins/tracker")
async def add_tracked_token(request: TokenTrackerAddRequest):
    """Add a token to the tracker."""
    mint = request.mint_address.strip()
    if not mint or len(mint) > 64:
        raise HTTPException(400, "Invalid mint address")

    interval = request.refresh_interval_minutes
    if interval not in (5, 15, 30, 60, 1440):
        raise HTTPException(400, "Invalid refresh interval. Must be 5, 15, 30, 60, or 1440.")

    from src.memecoins.token_tracker import TokenTrackerService

    async with async_session() as session:
        service = TokenTrackerService(session)
        token = await service.add_token(mint, source="manual", interval=interval)

        if not token:
            raise HTTPException(400, "Token not found on DexScreener")

        return {
            "id": token.id,
            "mintAddress": token.mint_address,
            "symbol": token.symbol,
            "name": token.name,
            "source": token.source,
            "refreshIntervalMinutes": token.refresh_interval_minutes,
            "isActive": token.is_active,
            "latestHolders": token.latest_holders,
            "latestPriceUsd": float(token.latest_price_usd) if token.latest_price_usd else None,
            "latestVolume24hUsd": float(token.latest_volume_24h_usd) if token.latest_volume_24h_usd else None,
            "latestMcapUsd": float(token.latest_mcap_usd) if token.latest_mcap_usd else None,
            "latestLiquidityUsd": float(token.latest_liquidity_usd) if token.latest_liquidity_usd else None,
            "lastRefreshedAt": token.last_refreshed_at.isoformat() if token.last_refreshed_at else None,
            "addedAt": token.added_at.isoformat(),
        }


@app.delete("/memecoins/tracker/{mint}")
async def deactivate_tracked_token(mint: str):
    """Deactivate a manually-added tracked token."""
    async with async_session() as session:
        result = await session.execute(
            select(TokenTracker).where(TokenTracker.mint_address == mint)
        )
        token = result.scalar_one_or_none()
        if not token:
            raise HTTPException(404, "Token not found")
        if token.source != "manual":
            raise HTTPException(400, "Only manually-added tokens can be deactivated")

        token.is_active = False
        await session.commit()
        return {"status": "deactivated", "mintAddress": mint}


@app.patch("/memecoins/tracker/{mint}")
async def update_tracked_token(mint: str, request: TokenTrackerUpdateRequest):
    """Update refresh interval for a tracked token."""
    interval = request.refresh_interval_minutes
    if interval not in (5, 15, 30, 60, 1440):
        raise HTTPException(400, "Invalid refresh interval. Must be 5, 15, 30, 60, or 1440.")

    async with async_session() as session:
        result = await session.execute(
            select(TokenTracker).where(TokenTracker.mint_address == mint)
        )
        token = result.scalar_one_or_none()
        if not token:
            raise HTTPException(404, "Token not found")

        token.refresh_interval_minutes = interval
        await session.commit()
        return {
            "mintAddress": token.mint_address,
            "refreshIntervalMinutes": token.refresh_interval_minutes,
        }


@app.get("/memecoins/tracker/{mint}/snapshots")
async def get_token_snapshots(mint: str, limit: int = 168):
    """Get historical snapshots for a tracked token."""
    limit = min(limit, 500)
    async with async_session() as session:
        token_result = await session.execute(
            select(TokenTracker).where(TokenTracker.mint_address == mint)
        )
        token = token_result.scalar_one_or_none()
        if not token:
            raise HTTPException(404, "Token not found")

        result = await session.execute(
            select(TokenTrackerSnapshot)
            .where(TokenTrackerSnapshot.token_id == token.id)
            .order_by(TokenTrackerSnapshot.snapshot_at.desc())
            .limit(limit)
        )
        snapshots = list(result.scalars().all())
        snapshots.reverse()  # Chronological order

        return [
            {
                "id": s.id,
                "holders": s.holders,
                "priceUsd": float(s.price_usd) if s.price_usd else None,
                "volume24hUsd": float(s.volume_24h_usd) if s.volume_24h_usd else None,
                "mcapUsd": float(s.mcap_usd) if s.mcap_usd else None,
                "snapshotAt": s.snapshot_at.isoformat(),
            }
            for s in snapshots
        ]


@app.post("/memecoins/twitter/poll")
async def trigger_memecoin_twitter():
    """Manually trigger a memecoin Twitter poll."""
    if not settings.twitter_bearer_token:
        raise HTTPException(400, "Twitter bearer token not configured")

    from src.memecoins.twitter_poller import MemecoinTwitterPoller

    async with async_session() as session:
        await load_llm_settings(session)
        poller = MemecoinTwitterPoller(session)
        result = await poller.poll()

    global last_memecoin_twitter_poll
    last_memecoin_twitter_poll = datetime.now(timezone.utc)
    return result


async def run_health_checks():
    """Scheduled job: run health checks for all services."""
    from src.health.checker import ServiceHealthChecker

    logger.info("Running health checks")
    try:
        async with async_session() as session:
            checker = ServiceHealthChecker(session)
            await checker.run_all_checks()
    except Exception as e:
        logger.exception(f"Health checks failed: {e}")


async def run_health_rollup():
    """Scheduled job: daily rollup of health checks + retention cleanup."""
    from src.health.checker import ServiceHealthChecker

    logger.info("Running health daily rollup")
    try:
        async with async_session() as session:
            checker = ServiceHealthChecker(session)
            await checker.rollup_daily()
            await checker.cleanup_old_checks()
    except Exception as e:
        logger.exception(f"Health rollup failed: {e}")


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

    # Periodic agent leaderboard + consensus broadcast for live updates
    async def _broadcast_agents_and_consensus():
        await _broadcast_agent_update()
        await _broadcast_consensus()

    scheduler.add_job(
        _broadcast_agents_and_consensus,
        trigger=IntervalTrigger(seconds=settings.sse_agent_broadcast_seconds),
        id="sse_agent_broadcast",
        name=f"SSE agent broadcast (every {settings.sse_agent_broadcast_seconds}s)",
        replace_existing=True,
        max_instances=1,
    )

    # Health checks (every 2 minutes)
    scheduler.add_job(
        run_health_checks,
        trigger=IntervalTrigger(minutes=2),
        id="health_check",
        name="Health check (every 2m)",
        replace_existing=True,
        max_instances=1,
    )

    # Health daily rollup + cleanup (00:05 UTC)
    scheduler.add_job(
        run_health_rollup,
        trigger=CronTrigger(hour=0, minute=5),
        id="health_daily_rollup",
        name="Health daily rollup + cleanup",
        replace_existing=True,
    )

    # PnL reconciliation (daily at 01:00 UTC)
    scheduler.add_job(
        run_pnl_reconciliation,
        trigger=CronTrigger(hour=1, minute=0),
        id="pnl_reconciliation",
        name="PnL reconciliation (daily at 01:00)",
        replace_existing=True,
    )

    # Memecoin wallet discovery (gated on feature flag)
    if settings.memecoin_enabled and settings.helius_api_key:
        from src.memecoins.wallet_discovery import run_wallet_discovery

        scheduler.add_job(
            run_wallet_discovery,
            trigger=IntervalTrigger(minutes=settings.memecoin_wallet_poll_minutes),
            id="wallet_discovery",
            name=f"Wallet cross-reference (every {settings.memecoin_wallet_poll_minutes}m)",
            replace_existing=True,
            max_instances=1,
        )

    # Token tracker refresh (every 1 minute — service decides which tokens are due)
    if settings.memecoin_enabled:
        from src.memecoins.token_tracker import run_token_tracker_refresh, run_token_tracker_cleanup

        scheduler.add_job(
            run_token_tracker_refresh,
            trigger=IntervalTrigger(minutes=1),
            id="token_tracker_refresh",
            name="Token tracker refresh (every 1m)",
            replace_existing=True,
            max_instances=1,
        )

        scheduler.add_job(
            run_token_tracker_cleanup,
            trigger=CronTrigger(hour=3, minute=30),
            id="token_tracker_cleanup",
            name="Token tracker snapshot cleanup (daily at 03:30)",
            replace_existing=True,
        )

    # Memecoin Twitter polling (gated on feature flag)
    if settings.memecoin_twitter_enabled and settings.twitter_bearer_token:
        scheduler.add_job(
            run_memecoin_twitter_poll,
            trigger=IntervalTrigger(minutes=settings.memecoin_twitter_poll_minutes),
            id="memecoin_twitter_poll",
            name=f"Memecoin Twitter poll (every {settings.memecoin_twitter_poll_minutes}m)",
            replace_existing=True,
            max_instances=1,
        )

    # Twitter polling (gated on feature flag)
    if settings.twitter_polling_enabled and settings.twitter_bearer_token:
        scheduler.add_job(
            run_twitter_poll,
            trigger=IntervalTrigger(minutes=settings.twitter_poll_interval_minutes),
            id="twitter_poll",
            name=f"Twitter poll (every {settings.twitter_poll_interval_minutes}m)",
            replace_existing=True,
            max_instances=1,
        )

    scheduler.start()
    logger.info(
        f"Scheduler started with {len(TIMEFRAME_CONFIG)} independent timeframe jobs + daily cleanup + daily digest + SSE broadcast + health checks"
        + (" + Twitter poll" if settings.twitter_polling_enabled else "")
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
