"""Post-mortem analyzer for discarded agents.

Extracts structured fleet lessons from agent trading history using Claude Haiku.
Lessons are scoped by strategy archetype and injected into evolution/decision contexts.
"""

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import anthropic

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.db import Agent, AgentTokenUsage, AgentTrade, FleetLesson, Symbol
from src.agents.context import ContextBuilder
from src.agents.executor import estimate_cost
from src.llm_settings import is_enabled

logger = logging.getLogger(__name__)

POSTMORTEM_MODEL = "claude-haiku-3-5-20241022"

EXTRACT_LESSONS_TOOL = {
    "name": "extract_lessons",
    "description": "Extract structured lessons from the agent's trading history.",
    "input_schema": {
        "type": "object",
        "properties": {
            "lessons": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "enum": ["strength", "mistake", "pattern"],
                            "description": "Type of lesson: strength (what worked), mistake (what failed), pattern (observed market behavior).",
                        },
                        "lesson": {
                            "type": "string",
                            "description": "Concise, actionable lesson (1-2 sentences).",
                        },
                    },
                    "required": ["category", "lesson"],
                },
                "minItems": 3,
                "maxItems": 7,
                "description": "3-7 structured lessons from the agent's trading history.",
            },
        },
        "required": ["lessons"],
    },
}

POSTMORTEM_SYSTEM_PROMPT = """You are a trading post-mortem analyst. You analyze the complete trading history of a discarded AI trading agent and extract structured lessons.

Your goal is to identify:
- STRENGTHS: What the agent did well (even if overall it failed)
- MISTAKES: Specific errors or bad patterns that led to losses
- PATTERNS: Market patterns the agent discovered (regardless of whether it profited)

Be specific and actionable. Reference actual trade outcomes. Each lesson should help future agents of the same archetype avoid mistakes or replicate successes.

Extract 3-7 lessons using the extract_lessons tool."""


class PostMortemAnalyzer:
    """Analyzes discarded agents and extracts fleet lessons."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def analyze(self, agent: Agent) -> list[FleetLesson]:
        """Run post-mortem analysis on a discarded agent.

        Returns list of created FleetLesson rows.
        """
        if not is_enabled("post_mortem"):
            logger.info(f"Skipping post-mortem for {agent.name} — post_mortem disabled")
            return []

        try:
            # Gather context
            trades = await self._get_recent_trades(agent.id, limit=20)
            if not trades:
                logger.info(f"No trades for post-mortem on {agent.name}, skipping")
                return []

            context_builder = ContextBuilder(self.session)
            performance = await context_builder._get_performance_stats(agent.id)
            memories = await context_builder._get_recent_memory(agent.id, limit=10)

            # Build prompt
            trades_str = "\n".join(
                f"- {t['symbol']} {t['direction'].upper()}: "
                f"PnL ${t['pnl']} ({t['outcome']}), exit: {t['exit_reason']}"
                for t in trades
            )
            memories_str = "\n".join(f"- {m}" for m in memories) or "No memories"

            user_prompt = f"""AGENT: {agent.name}
ARCHETYPE: {agent.strategy_archetype}
TIMEFRAME: {agent.timeframe}
DISCARD REASON: {agent.discard_reason or "Unknown"}

=== PERFORMANCE ===
Total Trades: {performance.total_trades}
Win Rate: {performance.win_rate:.1%}
Total PnL: ${performance.total_pnl}
Max Drawdown: {performance.max_drawdown:.1%}

=== RECENT TRADES ===
{trades_str}

=== AGENT MEMORIES ===
{memories_str}

Analyze this agent's history and extract lessons for future {agent.strategy_archetype} agents."""

            # Call Claude
            response = await self.client.messages.create(
                model=POSTMORTEM_MODEL,
                max_tokens=1024,
                system=POSTMORTEM_SYSTEM_PROMPT,
                tools=[EXTRACT_LESSONS_TOOL],
                tool_choice={"type": "tool", "name": "extract_lessons"},
                messages=[{"role": "user", "content": user_prompt}],
            )

            # Track cost
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            cost = estimate_cost(POSTMORTEM_MODEL, input_tokens, output_tokens)
            logger.info(
                f"Post-mortem for {agent.name}: "
                f"{input_tokens}in/{output_tokens}out, "
                f"${cost:.4f}"
            )

            # Persist token usage
            from datetime import date
            from sqlalchemy.dialects.postgresql import insert as pg_insert

            stmt = pg_insert(AgentTokenUsage).values(
                agent_id=agent.id,
                model=POSTMORTEM_MODEL,
                task_type="postmortem",
                date=date.today(),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=cost,
            ).on_conflict_do_update(
                index_elements=["agent_id", "model", "task_type", "date"],
                set_={
                    "input_tokens": AgentTokenUsage.input_tokens + input_tokens,
                    "output_tokens": AgentTokenUsage.output_tokens + output_tokens,
                    "estimated_cost_usd": AgentTokenUsage.estimated_cost_usd + cost,
                },
            )
            await self.session.execute(stmt)

            # Parse tool response
            lessons_data = self._parse_response(response)
            if not lessons_data:
                logger.warning(f"No lessons extracted from post-mortem for {agent.name}")
                return []

            # Build context snapshot
            context_snapshot = {
                "total_trades": performance.total_trades,
                "win_rate": float(performance.win_rate),
                "total_pnl": float(performance.total_pnl),
                "max_drawdown": float(performance.max_drawdown),
                "discard_reason": agent.discard_reason,
            }

            # Create FleetLesson rows
            created = []
            for item in lessons_data:
                lesson = FleetLesson(
                    agent_id=agent.id,
                    archetype=agent.strategy_archetype,
                    category=item["category"],
                    lesson=item["lesson"],
                    context=context_snapshot,
                )
                self.session.add(lesson)
                created.append(lesson)

            await self.session.flush()
            return created

        except Exception:
            logger.exception(f"Post-mortem analysis failed for {agent.name}")
            return []

    def _parse_response(self, response: Any) -> list[dict]:
        """Extract lessons from Claude tool_use response."""
        for block in response.content:
            if block.type == "tool_use" and block.name == "extract_lessons":
                raw = block.input.get("lessons", [])
                # Validate categories
                valid = []
                for item in raw:
                    if item.get("category") in ("strength", "mistake", "pattern") and item.get("lesson"):
                        valid.append(item)
                return valid
        return []

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
