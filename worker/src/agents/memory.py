"""Memory manager for agent learning.

Handles:
- Generating trade reflections via Claude
- Storing and retrieving memory entries
- Auto-tagging memories with relevant labels
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

import anthropic
from anthropic import APITimeoutError, APIConnectionError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.db import Agent, AgentMemory, AgentTrade, Symbol
from src.agents.executor import estimate_cost, MODEL_PRICING

logger = logging.getLogger(__name__)

# System prompt for memory generation
MEMORY_SYSTEM_PROMPT = """You are a trading analyst assistant. Your job is to analyze completed trades and extract a concise lesson learned.

Given the trade details, write a 1-3 sentence reflection that captures:
- What worked or didn't work
- Key market conditions or signals that were relevant
- Actionable insight for future similar situations

Be specific and actionable. Focus on the "why" behind the outcome."""


class MemoryManager:
    """Manages agent memory generation and retrieval."""

    def __init__(self, session: AsyncSession, api_key: str | None = None):
        self.session = session
        self.client = anthropic.Anthropic(api_key=api_key or settings.anthropic_api_key)

    async def generate_memory(
        self,
        agent: Agent,
        trade: AgentTrade,
    ) -> AgentMemory | None:
        """Generate a memory entry for a completed trade.

        Args:
            agent: The agent that made the trade.
            trade: The completed trade to reflect on.

        Returns:
            AgentMemory record if successful, None on failure.
        """
        logger.debug(f"Generating memory for agent {agent.name}, trade {trade.id}")

        # Get symbol name
        symbol_result = await self.session.execute(
            select(Symbol.symbol).where(Symbol.id == trade.symbol_id)
        )
        symbol_name = symbol_result.scalar_one_or_none() or "UNKNOWN"

        # Build user message with trade context
        user_message = self._build_trade_context(trade, symbol_name)

        # Call Claude API (use scan_model for cost efficiency)
        try:
            response = self.client.messages.create(
                model=agent.scan_model,
                max_tokens=256,
                system=MEMORY_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
        except (APITimeoutError, APIConnectionError) as e:
            logger.warning(f"Memory generation API error: {e}")
            return None

        # Extract lesson from response
        lesson = ""
        for block in response.content:
            if block.type == "text":
                lesson = block.text.strip()
                break

        if not lesson:
            logger.warning("No lesson extracted from memory generation response")
            return None

        # Generate tags
        tags = self._generate_tags(trade, symbol_name)

        # Create memory record
        memory = AgentMemory(
            agent_id=agent.id,
            trade_id=trade.id,
            lesson=lesson,
            tags=tags,
        )
        self.session.add(memory)
        await self.session.flush()

        # Track token usage
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost = estimate_cost(agent.scan_model, input_tokens, output_tokens)

        logger.info(
            f"Generated memory for agent {agent.name}: {lesson[:100]}... "
            f"(cost: ${cost:.4f})"
        )

        return memory

    def _build_trade_context(self, trade: AgentTrade, symbol: str) -> str:
        """Build context message for memory generation."""
        pnl_pct = (trade.pnl / trade.position_size) * 100 if trade.position_size else 0
        outcome = "WIN" if trade.pnl > 0 else "LOSS" if trade.pnl < 0 else "BREAK-EVEN"

        duration_str = ""
        if trade.duration_minutes < 60:
            duration_str = f"{trade.duration_minutes} minutes"
        elif trade.duration_minutes < 1440:
            hours = trade.duration_minutes / 60
            duration_str = f"{hours:.1f} hours"
        else:
            days = trade.duration_minutes / 1440
            duration_str = f"{days:.1f} days"

        return f"""Analyze this completed trade and provide a brief lesson learned:

Symbol: {symbol}
Direction: {trade.direction.upper()}
Entry Price: ${trade.entry_price}
Exit Price: ${trade.exit_price}
Position Size: ${trade.position_size}
PnL: ${trade.pnl} ({pnl_pct:.2f}%)
Outcome: {outcome}
Exit Reason: {trade.exit_reason.replace('_', ' ').title()}
Duration: {duration_str}

What's the key lesson from this trade?"""

    def _generate_tags(self, trade: AgentTrade, symbol: str) -> list[str]:
        """Generate auto-tags for a memory entry."""
        tags = []

        # Symbol tag
        tags.append(f"symbol:{symbol}")

        # Outcome tag
        if trade.pnl > 0:
            tags.append("outcome:win")
        elif trade.pnl < 0:
            tags.append("outcome:loss")
        else:
            tags.append("outcome:breakeven")

        # Direction tag
        tags.append(f"direction:{trade.direction}")

        # Exit reason tag
        tags.append(f"exit:{trade.exit_reason}")

        # PnL magnitude tags
        pnl_pct = abs(float(trade.pnl / trade.position_size * 100)) if trade.position_size else 0
        if pnl_pct >= 10:
            tags.append("magnitude:large")
        elif pnl_pct >= 5:
            tags.append("magnitude:medium")
        else:
            tags.append("magnitude:small")

        # Duration tags
        if trade.duration_minutes < 60:
            tags.append("duration:quick")
        elif trade.duration_minutes < 1440:
            tags.append("duration:intraday")
        else:
            tags.append("duration:swing")

        return tags

    async def get_recent_memory(
        self,
        agent_id: int,
        limit: int = 20,
        tags_filter: list[str] | None = None,
    ) -> list[AgentMemory]:
        """Get recent memory entries for an agent.

        Args:
            agent_id: The agent ID.
            limit: Maximum entries to return.
            tags_filter: Optional list of tags to filter by.

        Returns:
            List of AgentMemory records, most recent first.
        """
        query = (
            select(AgentMemory)
            .where(AgentMemory.agent_id == agent_id)
            .order_by(AgentMemory.created_at.desc())
            .limit(limit)
        )

        result = await self.session.execute(query)
        memories = list(result.scalars().all())

        # Filter by tags if specified (client-side for flexibility)
        if tags_filter:
            memories = [
                m for m in memories
                if any(tag in m.tags for tag in tags_filter)
            ]

        return memories

    async def get_memory_for_symbol(
        self,
        agent_id: int,
        symbol: str,
        limit: int = 5,
    ) -> list[AgentMemory]:
        """Get memory entries for a specific symbol.

        Args:
            agent_id: The agent ID.
            symbol: The symbol to filter by.
            limit: Maximum entries to return.

        Returns:
            List of AgentMemory records for the symbol.
        """
        memories = await self.get_recent_memory(agent_id, limit=100)
        symbol_tag = f"symbol:{symbol}"
        return [m for m in memories if symbol_tag in m.tags][:limit]
