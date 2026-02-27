"""Consensus API endpoints.

GET /consensus — Agent position consensus grouped by source (technical, tweet, mixed)
"""

import logging

from fastapi import APIRouter
from sqlalchemy import func, select

from src.db import async_session
from src.models.db import Agent, AgentPosition, Symbol

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/consensus", tags=["consensus"])


@router.get("")
async def get_consensus():
    """Agent consensus data: positions grouped by symbol/source/direction.

    Replicates the _broadcast_consensus() logic from main.py and
    the frontend getConsensusData() query.

    Returns consensus for three categories:
    - technical: only technical-source agents
    - tweet: only tweet-source agents
    - mixed: all active agents combined
    """
    async with async_session() as session:
        # Query 1: positions by symbol/source/direction
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

        # Query 2: total active agents per source
        agent_count_result = await session.execute(
            select(Agent.source, func.count().label("agent_count"))
            .where(Agent.status == "active")
            .group_by(Agent.source)
        )
        agent_count_rows = agent_count_result.all()

    # Build agent count lookup
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
        """Compute consensus items for a set of agent sources.

        Args:
            filter_sources: List of source strings to include, or None for all sources.

        Returns:
            List of consensus items sorted by consensus percentage descending.
            Threshold: >= 50% consensus, minimum 2 agents.
        """
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

    return {
        "technical": compute_consensus(["technical"]),
        "tweet": compute_consensus(["tweet"]),
        "mixed": compute_consensus(None),
    }
