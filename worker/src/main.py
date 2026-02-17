"""Alpha Worker entrypoint with FastAPI and APScheduler.

Provides:
- /health — Health check endpoint (detailed, for Fly.io checks)
- /status — Scheduler status and job list
- /trigger/{timeframe} — Manual pipeline trigger
- Scheduled pipeline runs based on timeframe cadence
- Daily retention cleanup for old partitions
"""

import json
import logging
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy import select, func, text

from src.agents.context import ContextBuilder
from src.agents.orchestrator import AgentOrchestrator
from src.agents.rule_executor import RuleBasedExecutor
from src.cache import cache_delete, get_redis
from src.config import settings
from src.db import async_session, engine
from src.events import event_bus
from src.models.db import Agent, AgentPortfolio, AgentPosition, AgentTrade, AgentTokenUsage, BacktestRun, BacktestTrade, Snapshot, Symbol, Tweet, TweetSignal, TwitterAccount
from src.notifications.digest import send_daily_digest_job
from src.notifications.routes import router as notifications_router
from src.pipeline import TIMEFRAME_CONFIG, PipelineRunner, compute_and_persist_regime
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
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(notifications_router)
app.include_router(sse_router)
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

                agents.append({
                    "id": agent.id,
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
                    "totalRealizedPnl": float(portfolio.total_realized_pnl),
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

            # Build lookup: { symbol -> { source -> { long: n, short: n } } }
            lookup: dict[str, dict[str, dict[str, int]]] = {}
            for symbol, source, direction, count in rows:
                lookup.setdefault(symbol, {}).setdefault(source, {"long": 0, "short": 0})
                lookup[symbol][source][direction] += count

            def compute_consensus(filter_sources: list[str] | None) -> list[dict]:
                items = []
                for symbol, source_map in lookup.items():
                    total_longs = 0
                    total_shorts = 0
                    for source, counts in source_map.items():
                        if filter_sources is None or source in filter_sources:
                            total_longs += counts["long"]
                            total_shorts += counts["short"]

                    total = total_longs + total_shorts
                    if total < 2:
                        continue

                    majority = max(total_longs, total_shorts)
                    consensus_pct = round(majority / total * 100)
                    if consensus_pct < 50:
                        continue

                    items.append({
                        "symbol": symbol,
                        "direction": "long" if total_longs >= total_shorts else "short",
                        "consensusPct": consensus_pct,
                        "longCount": total_longs,
                        "shortCount": total_shorts,
                        "totalAgents": total,
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
    engine = BacktestEngine()

    async with async_session() as session:
        await engine.run(config, session, run_id=run_id)


@app.post("/backtest")
async def create_backtest(
    request: BacktestRequest, background_tasks: BackgroundTasks
):
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

    background_tasks.add_task(_run_backtest, run_id, config_dict)

    return {"run_id": run_id, "status": "pending"}


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
        f"Scheduler started with {len(TIMEFRAME_CONFIG)} independent timeframe jobs + daily cleanup + daily digest + SSE broadcast"
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
