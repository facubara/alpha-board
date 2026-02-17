"""Evolution manager for prompt evolution and auto-revert.

Handles:
- Triggering prompt evolution after N trades
- Generating improved prompts via Claude
- Auto-reverting if performance degrades after evolution
- Version management
"""

import difflib
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import anthropic
from anthropic import APITimeoutError, APIConnectionError
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.db import Agent, AgentPrompt, AgentTrade, AgentPortfolio, FleetLesson
from src.agents.executor import estimate_cost
from src.agents.context import ContextBuilder

logger = logging.getLogger(__name__)

# Revert threshold: if PnL drops by this percentage after evolution, revert
REVERT_THRESHOLD_PCT = 0.20  # 20%

# Number of trades to evaluate before considering revert
REVERT_EVALUATION_TRADES = 5

# Evolution meta-prompt
EVOLUTION_SYSTEM_PROMPT = """You are an expert trading strategy optimizer. Your job is to analyze an agent's performance and improve its trading prompt.

Given:
1. The current trading prompt
2. Performance statistics (PnL, win rate, drawdown)
3. Recent trade history with reasoning
4. Memory/lessons learned

Your task:
- Identify patterns in successful and unsuccessful trades
- Find weaknesses in the current strategy prompt
- Propose specific, actionable improvements
- Maintain the agent's core strategy archetype

Output the COMPLETE improved prompt. Do not include meta-commentary or explanations outside the prompt.

Guidelines:
- Keep the prompt focused and under 1500 words
- Be specific about entry/exit conditions
- Include risk management rules
- Reference the indicators and signals available to the agent"""


class EvolutionManager:
    """Manages prompt evolution and auto-revert logic."""

    def __init__(self, session: AsyncSession, api_key: str | None = None):
        self.session = session
        self.client = anthropic.Anthropic(api_key=api_key or settings.anthropic_api_key)

    async def check_evolution_trigger(self, agent_id: int) -> bool:
        """Check if an agent should trigger evolution.

        Evolution triggers when:
        - Agent has completed N trades since last evolution (configurable threshold)

        Args:
            agent_id: The agent to check.

        Returns:
            True if evolution should trigger.
        """
        # Get agent and threshold
        result = await self.session.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            return False

        # Get last evolution time (when prompt version changed to 'auto')
        last_evolution = await self._get_last_evolution_time(agent_id)

        # Count trades since last evolution
        query = select(func.count(AgentTrade.id)).where(
            AgentTrade.agent_id == agent_id
        )
        if last_evolution:
            query = query.where(AgentTrade.closed_at > last_evolution)

        result = await self.session.execute(query)
        trades_since_evolution = result.scalar() or 0

        should_trigger = trades_since_evolution >= agent.evolution_trade_threshold
        if should_trigger:
            logger.info(
                f"Agent {agent.name} ready for evolution: "
                f"{trades_since_evolution} trades since last evolution "
                f"(threshold: {agent.evolution_trade_threshold})"
            )

        return should_trigger

    async def trigger_evolution(self, agent_id: int) -> AgentPrompt | None:
        """Trigger prompt evolution for an agent.

        Args:
            agent_id: The agent to evolve.

        Returns:
            New AgentPrompt if successful, None on failure.
        """
        logger.info(f"Triggering evolution for agent {agent_id}")

        # Get agent
        result = await self.session.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            logger.error(f"Agent {agent_id} not found")
            return None

        # Get current active prompt
        current_prompt = await self._get_active_prompt(agent_id)
        if not current_prompt:
            logger.error(f"No active prompt for agent {agent_id}")
            return None

        # Build evolution context
        context = await self._build_evolution_context(agent, current_prompt)

        # Call Claude API to generate improved prompt
        try:
            response = self.client.messages.create(
                model=agent.evolution_model,
                max_tokens=2048,
                system=EVOLUTION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": context}],
            )
        except (APITimeoutError, APIConnectionError) as e:
            logger.error(f"Evolution API error: {e}")
            return None

        # Extract new prompt
        new_prompt_text = ""
        for block in response.content:
            if block.type == "text":
                new_prompt_text = block.text.strip()
                break

        if not new_prompt_text or len(new_prompt_text) < 100:
            logger.error("Evolution returned empty or too short prompt")
            return None

        # Calculate diff
        diff = self._generate_diff(current_prompt.system_prompt, new_prompt_text)

        # Get current performance snapshot
        performance = await self._get_performance_snapshot(agent_id)

        # Create new prompt version
        new_version = current_prompt.version + 1
        new_prompt = AgentPrompt(
            agent_id=agent_id,
            version=new_version,
            system_prompt=new_prompt_text,
            source="auto",
            diff_from_previous=diff,
            performance_at_change=performance,
            is_active=True,
        )

        # Deactivate old prompt
        await self.session.execute(
            update(AgentPrompt)
            .where(AgentPrompt.agent_id == agent_id)
            .where(AgentPrompt.is_active == True)  # noqa: E712
            .values(is_active=False)
        )

        self.session.add(new_prompt)
        await self.session.flush()

        # Track token usage
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost = estimate_cost(agent.evolution_model, input_tokens, output_tokens)

        logger.info(
            f"Evolution complete for agent {agent.name}: "
            f"v{current_prompt.version} -> v{new_version} "
            f"(cost: ${cost:.4f})"
        )

        return new_prompt

    async def check_auto_revert(self, agent_id: int) -> bool:
        """Check if agent should revert to previous prompt.

        Revert if PnL has dropped >20% since the last evolution.

        Args:
            agent_id: The agent to check.

        Returns:
            True if revert was triggered.
        """
        # Get current active prompt
        current_prompt = await self._get_active_prompt(agent_id)
        if not current_prompt or current_prompt.source != "auto":
            return False  # Only auto-generated prompts can be auto-reverted

        if not current_prompt.performance_at_change:
            return False  # No baseline to compare

        # Count trades since this prompt was activated
        trades_since = await self._count_trades_since(
            agent_id, current_prompt.created_at
        )
        if trades_since < REVERT_EVALUATION_TRADES:
            return False  # Not enough trades to evaluate

        # Get current performance
        current_pnl = await self._get_current_pnl(agent_id)
        baseline_pnl = Decimal(str(
            current_prompt.performance_at_change.get("total_pnl", 0)
        ))

        # Calculate PnL change since evolution
        pnl_change = current_pnl - baseline_pnl
        pnl_change_pct = (
            float(pnl_change / abs(baseline_pnl))
            if baseline_pnl != 0
            else float(pnl_change / 10000)  # Use initial balance as reference
        )

        if pnl_change_pct < -REVERT_THRESHOLD_PCT:
            logger.warning(
                f"Agent {agent_id} PnL dropped {pnl_change_pct:.1%} since evolution, "
                f"triggering auto-revert"
            )
            await self._revert_to_previous(agent_id, current_prompt)
            return True

        return False

    async def _revert_to_previous(
        self,
        agent_id: int,
        current_prompt: AgentPrompt,
    ) -> AgentPrompt | None:
        """Revert to the previous prompt version.

        Args:
            agent_id: The agent.
            current_prompt: The current (failing) prompt.

        Returns:
            The reactivated prompt.
        """
        # Find previous version
        result = await self.session.execute(
            select(AgentPrompt)
            .where(AgentPrompt.agent_id == agent_id)
            .where(AgentPrompt.version == current_prompt.version - 1)
        )
        previous_prompt = result.scalar_one_or_none()

        if not previous_prompt:
            logger.error(f"No previous prompt found for agent {agent_id}")
            return None

        # Deactivate current prompt
        await self.session.execute(
            update(AgentPrompt)
            .where(AgentPrompt.id == current_prompt.id)
            .values(is_active=False)
        )

        # Reactivate previous prompt
        await self.session.execute(
            update(AgentPrompt)
            .where(AgentPrompt.id == previous_prompt.id)
            .values(is_active=True)
        )

        await self.session.flush()

        logger.info(
            f"Reverted agent {agent_id} from v{current_prompt.version} "
            f"to v{previous_prompt.version}"
        )

        return previous_prompt

    async def _get_active_prompt(self, agent_id: int) -> AgentPrompt | None:
        """Get the active prompt for an agent."""
        result = await self.session.execute(
            select(AgentPrompt).where(
                AgentPrompt.agent_id == agent_id,
                AgentPrompt.is_active == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def _get_last_evolution_time(self, agent_id: int) -> datetime | None:
        """Get the timestamp of the last auto-evolution."""
        result = await self.session.execute(
            select(AgentPrompt.created_at)
            .where(AgentPrompt.agent_id == agent_id)
            .where(AgentPrompt.source == "auto")
            .order_by(AgentPrompt.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _build_evolution_context(
        self,
        agent: Agent,
        current_prompt: AgentPrompt,
    ) -> str:
        """Build context for the evolution prompt."""
        # Get recent trades with reasoning
        trades = await self._get_recent_trades(agent.id, limit=20)

        # Get performance stats
        context_builder = ContextBuilder(self.session)
        performance = await context_builder._get_performance_stats(agent.id)

        # Get recent memory
        memories = await context_builder._get_recent_memory(agent.id, limit=10)

        # Format trades
        trades_str = "\n".join(
            f"- {t['symbol']} {t['direction'].upper()}: "
            f"PnL ${t['pnl']} ({t['outcome']}), exit: {t['exit_reason']}"
            for t in trades
        )

        # Format memories
        memories_str = "\n".join(f"- {m}" for m in memories) or "No memories yet"

        # Fleet lessons from discarded agents of same archetype
        fleet_lessons = await self._get_fleet_lessons(agent.strategy_archetype)
        fleet_lessons_str = "\n".join(
            f"- [{l.category}] {l.lesson}" for l in fleet_lessons
        ) or "No fleet lessons yet"

        return f"""AGENT: {agent.name}
ARCHETYPE: {agent.strategy_archetype}
TIMEFRAME: {agent.timeframe}

=== CURRENT PROMPT (v{current_prompt.version}) ===
{current_prompt.system_prompt}

=== PERFORMANCE STATS ===
Total Trades: {performance.total_trades}
Win Rate: {performance.win_rate:.1%}
Total PnL: ${performance.total_pnl}
Max Drawdown: {performance.max_drawdown:.1%}

=== RECENT TRADES ===
{trades_str}

=== LESSONS LEARNED ===
{memories_str}

=== FLEET LESSONS (from discarded {agent.strategy_archetype} agents) ===
{fleet_lessons_str}

Based on this analysis, generate an improved version of the prompt that addresses any weaknesses while maintaining the agent's core {agent.strategy_archetype} strategy."""

    async def _get_recent_trades(
        self,
        agent_id: int,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Get recent trades with relevant info."""
        result = await self.session.execute(
            select(AgentTrade, Symbol)
            .join(Symbol, AgentTrade.symbol_id == Symbol.id)
            .where(AgentTrade.agent_id == agent_id)
            .order_by(AgentTrade.closed_at.desc())
            .limit(limit)
        )
        rows = result.all()

        trades = []
        for trade, symbol in rows:
            outcome = "WIN" if trade.pnl > 0 else "LOSS" if trade.pnl < 0 else "BREAK-EVEN"
            trades.append({
                "symbol": symbol.symbol,
                "direction": trade.direction,
                "pnl": trade.pnl,
                "outcome": outcome,
                "exit_reason": trade.exit_reason,
            })

        return trades

    async def _get_fleet_lessons(self, archetype: str) -> list[FleetLesson]:
        """Get active fleet lessons for a given strategy archetype."""
        result = await self.session.execute(
            select(FleetLesson)
            .where(FleetLesson.archetype == archetype, FleetLesson.is_active.is_(True))
            .order_by(FleetLesson.created_at.desc())
            .limit(20)
        )
        return list(result.scalars().all())

    async def _get_performance_snapshot(self, agent_id: int) -> dict[str, Any]:
        """Get current performance as a snapshot."""
        context_builder = ContextBuilder(self.session)
        performance = await context_builder._get_performance_stats(agent_id)

        return {
            "total_trades": performance.total_trades,
            "winning_trades": performance.winning_trades,
            "losing_trades": performance.losing_trades,
            "win_rate": performance.win_rate,
            "total_pnl": str(performance.total_pnl),
            "max_drawdown": performance.max_drawdown,
        }

    async def _count_trades_since(
        self,
        agent_id: int,
        since: datetime,
    ) -> int:
        """Count trades since a given timestamp."""
        result = await self.session.execute(
            select(func.count(AgentTrade.id))
            .where(AgentTrade.agent_id == agent_id)
            .where(AgentTrade.closed_at > since)
        )
        return result.scalar() or 0

    async def _get_current_pnl(self, agent_id: int) -> Decimal:
        """Get current total PnL for an agent."""
        result = await self.session.execute(
            select(AgentPortfolio.total_realized_pnl)
            .where(AgentPortfolio.agent_id == agent_id)
        )
        return result.scalar_one_or_none() or Decimal("0.00")

    def _generate_diff(self, old_text: str, new_text: str) -> str:
        """Generate a unified diff between two texts."""
        old_lines = old_text.splitlines(keepends=True)
        new_lines = new_text.splitlines(keepends=True)

        diff = difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile="previous",
            tofile="current",
            lineterm="",
        )
        return "".join(diff)
