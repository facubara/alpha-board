"""Daily PnL digest computation and sending.

Queries the database for today's trading activity and sends a summary
via Telegram.
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import async_session
from src.models.db import Agent, AgentPortfolio, AgentPosition, AgentPrompt, AgentTrade
from src.notifications.models import DailyDigestData
from src.notifications.service import NotificationService

logger = logging.getLogger(__name__)


async def compute_daily_digest(session: AsyncSession) -> DailyDigestData:
    """Compute daily digest data from the database.

    Args:
        session: Async database session.

    Returns:
        DailyDigestData with today's aggregated stats.
    """
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    # Total and active agent counts
    total_result = await session.execute(select(func.count(Agent.id)))
    total_agents = total_result.scalar() or 0

    active_result = await session.execute(
        select(func.count(Agent.id)).where(Agent.status == "active")
    )
    active_agents = active_result.scalar() or 0

    # Today's trades
    trades_result = await session.execute(
        select(AgentTrade).where(AgentTrade.closed_at >= today_start)
    )
    trades = list(trades_result.scalars().all())
    total_trades = len(trades)
    winning = sum(1 for t in trades if t.pnl > 0)
    losing = sum(1 for t in trades if t.pnl <= 0)
    total_pnl = sum((t.pnl for t in trades), Decimal("0.00"))

    # Best and worst agents by PnL today
    agent_pnl: dict[int, Decimal] = {}
    for t in trades:
        agent_pnl[t.agent_id] = agent_pnl.get(t.agent_id, Decimal("0.00")) + t.pnl

    best_agent_name = None
    best_agent_pnl = None
    worst_agent_name = None
    worst_agent_pnl = None

    if agent_pnl:
        best_id = max(agent_pnl, key=lambda k: agent_pnl[k])
        worst_id = min(agent_pnl, key=lambda k: agent_pnl[k])

        for agent_id, label in [(best_id, "best"), (worst_id, "worst")]:
            agent_result = await session.execute(
                select(Agent.name).where(Agent.id == agent_id)
            )
            name = agent_result.scalar_one_or_none()
            if label == "best":
                best_agent_name = name
                best_agent_pnl = agent_pnl[agent_id]
            else:
                worst_agent_name = name
                worst_agent_pnl = agent_pnl[agent_id]

    # Total equity across all portfolios
    equity_result = await session.execute(
        select(func.sum(AgentPortfolio.total_equity))
    )
    total_equity = equity_result.scalar() or Decimal("0.00")

    # Open positions count
    positions_result = await session.execute(select(func.count(AgentPosition.id)))
    open_positions = positions_result.scalar() or 0

    # Evolutions today
    evolutions_result = await session.execute(
        select(func.count(AgentPrompt.id)).where(
            AgentPrompt.created_at >= today_start,
            AgentPrompt.source == "auto",
        )
    )
    evolutions_today = evolutions_result.scalar() or 0

    return DailyDigestData(
        date=today.isoformat(),
        total_agents=total_agents,
        active_agents=active_agents,
        total_trades_today=total_trades,
        winning_trades=winning,
        losing_trades=losing,
        total_pnl=total_pnl,
        best_agent_name=best_agent_name,
        best_agent_pnl=best_agent_pnl,
        worst_agent_name=worst_agent_name,
        worst_agent_pnl=worst_agent_pnl,
        total_equity=total_equity,
        open_positions=open_positions,
        evolutions_today=evolutions_today,
    )


async def send_daily_digest_job() -> None:
    """Scheduled job: compute and send the daily digest.

    Creates its own session since APScheduler jobs run outside request scope.
    """
    logger.info("Running daily digest job")
    try:
        async with async_session() as session:
            data = await compute_daily_digest(session)
            service = NotificationService(session)
            await service.send_daily_digest(data)
        logger.info("Daily digest sent successfully")
    except Exception:
        logger.exception("Error sending daily digest")
