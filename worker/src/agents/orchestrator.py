"""Agent orchestrator for running agent cycles.

Handles:
- Running all agents for a timeframe
- Decision logging
- Token usage tracking
- Integration with pipeline
"""

import logging
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from src.models.db import (
    Agent,
    AgentDecision,
    AgentPrompt,
    AgentTokenUsage,
)
from src.agents.schemas import (
    ActionType,
    AgentDecisionResult,
    ExecutionResult,
)
from src.agents.context import ContextBuilder
from src.agents.executor import AgentExecutor
from src.agents.portfolio import PortfolioManager

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """Orchestrates agent decision cycles."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.context_builder = ContextBuilder(session)
        self.executor = AgentExecutor()
        self.portfolio_manager = PortfolioManager(session)

    async def run_cycle(
        self,
        timeframe: str,
        current_prices: dict[str, Decimal],
        candle_data: dict[str, dict[str, Decimal]] | None = None,
    ) -> dict[str, Any]:
        """Run a full agent cycle for a timeframe.

        Args:
            timeframe: The timeframe to process (e.g., "1h").
            current_prices: Dict of symbol -> current price.
            candle_data: Optional dict of symbol -> {high, low, close} for SL/TP checks.

        Returns:
            Summary of the cycle results.
        """
        logger.info(f"Starting agent cycle for {timeframe}")
        start_time = datetime.now(timezone.utc)

        # Get all active agents for this timeframe
        agents = await self._get_active_agents(timeframe)
        logger.info(f"Found {len(agents)} active agents for {timeframe}")

        results = {
            "timeframe": timeframe,
            "agents_processed": 0,
            "decisions": [],
            "executions": [],
            "errors": [],
            "total_tokens": {"input": 0, "output": 0},
            "total_cost_usd": Decimal("0.00"),
        }

        for agent in agents:
            try:
                agent_result = await self._process_agent(
                    agent, current_prices, candle_data
                )
                results["agents_processed"] += 1
                results["decisions"].append(agent_result["decision"])

                if agent_result.get("execution"):
                    results["executions"].append(agent_result["execution"])

                results["total_tokens"]["input"] += agent_result["decision"].input_tokens
                results["total_tokens"]["output"] += agent_result["decision"].output_tokens
                results["total_cost_usd"] += agent_result["decision"].estimated_cost_usd

            except Exception as e:
                logger.exception(f"Error processing agent {agent.name}: {e}")
                results["errors"].append({
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "error": str(e),
                })

        # Commit all changes
        await self.session.commit()

        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
        logger.info(
            f"Agent cycle for {timeframe} complete: "
            f"{results['agents_processed']} agents, "
            f"{len(results['executions'])} executions, "
            f"{len(results['errors'])} errors, "
            f"${results['total_cost_usd']:.4f} cost, "
            f"{elapsed:.1f}s elapsed"
        )

        return results

    async def _process_agent(
        self,
        agent: Agent,
        current_prices: dict[str, Decimal],
        candle_data: dict[str, dict[str, Decimal]] | None,
    ) -> dict[str, Any]:
        """Process a single agent.

        Args:
            agent: The agent to process.
            current_prices: Dict of symbol -> current price.
            candle_data: Optional candle data for SL/TP checks.

        Returns:
            Dict with decision and optional execution result.
        """
        logger.debug(f"Processing agent {agent.name}")

        # First, check stop loss / take profit
        if candle_data:
            sl_tp_results = await self.portfolio_manager.check_stop_loss_take_profit(
                agent.id, candle_data
            )
            for result in sl_tp_results:
                logger.info(
                    f"Agent {agent.name}: {result.action.value} {result.symbol} "
                    f"({result.details.get('exit_reason')})"
                )

        # Update unrealized PnL
        await self.portfolio_manager.update_unrealized_pnl(agent.id, current_prices)

        # Build context
        context = await self.context_builder.build(agent, current_prices)

        # Get active prompt
        prompt = await self._get_active_prompt(agent.id)
        if not prompt:
            logger.warning(f"No active prompt for agent {agent.name}")
            return {"decision": None, "execution": None}

        # Execute decision
        decision = await self.executor.decide(
            context=context,
            system_prompt=prompt.system_prompt,
            model=agent.trade_model,
            prompt_version=prompt.version,
        )

        # Log decision to database
        decision_record = await self._log_decision(agent.id, decision)

        # Track token usage
        await self._track_token_usage(
            agent.id,
            agent.trade_model,
            "trade",
            decision.input_tokens,
            decision.output_tokens,
            decision.estimated_cost_usd,
        )

        result = {"decision": decision, "execution": None}

        # Execute action if not hold
        if decision.action.action != ActionType.HOLD:
            execution = await self._execute_action(
                agent.id,
                decision,
                current_prices,
                decision_record.id if decision_record else None,
            )
            result["execution"] = execution

        return result

    async def _execute_action(
        self,
        agent_id: int,
        decision: AgentDecisionResult,
        current_prices: dict[str, Decimal],
        decision_id: int | None,
    ) -> ExecutionResult | None:
        """Execute the agent's decided action.

        Args:
            agent_id: The agent executing.
            decision: The decision to execute.
            current_prices: Current market prices.
            decision_id: ID of the logged decision.

        Returns:
            ExecutionResult if action was executed.
        """
        action = decision.action

        # Validate action
        validation = await self.portfolio_manager.validate_action(
            agent_id, action, current_prices
        )

        if not validation.is_valid:
            logger.warning(
                f"Agent {agent_id} action invalid: {validation.error_message}"
            )
            return ExecutionResult(
                success=False,
                action=action.action,
                symbol=action.symbol,
                error_message=validation.error_message,
            )

        # Log warnings
        for warning in validation.warnings:
            logger.warning(f"Agent {agent_id}: {warning}")

        # Execute based on action type
        if action.action in (ActionType.OPEN_LONG, ActionType.OPEN_SHORT):
            current_price = current_prices.get(action.symbol)
            if not current_price:
                return ExecutionResult(
                    success=False,
                    action=action.action,
                    symbol=action.symbol,
                    error_message=f"No price for {action.symbol}",
                )

            return await self.portfolio_manager.open_position(
                agent_id, action, current_price, decision_id
            )

        elif action.action == ActionType.CLOSE:
            current_price = current_prices.get(action.symbol)
            if not current_price:
                return ExecutionResult(
                    success=False,
                    action=action.action,
                    symbol=action.symbol,
                    error_message=f"No price for {action.symbol}",
                )

            return await self.portfolio_manager.close_position(
                agent_id, action.symbol, current_price, "agent_decision", decision_id
            )

        return None

    async def _get_active_agents(self, timeframe: str) -> list[Agent]:
        """Get all active agents for a timeframe."""
        result = await self.session.execute(
            select(Agent).where(
                Agent.timeframe == timeframe,
                Agent.status == "active",
            )
        )
        return list(result.scalars().all())

    async def _get_active_prompt(self, agent_id: int) -> AgentPrompt | None:
        """Get the active prompt for an agent."""
        result = await self.session.execute(
            select(AgentPrompt).where(
                AgentPrompt.agent_id == agent_id,
                AgentPrompt.is_active == True,
            )
        )
        return result.scalar_one_or_none()

    async def _log_decision(
        self,
        agent_id: int,
        decision: AgentDecisionResult,
    ) -> AgentDecision | None:
        """Log a decision to the database."""
        # Get symbol ID if applicable
        symbol_id = None
        if decision.action.symbol:
            result = await self.session.execute(
                select(Agent).where(Agent.id == agent_id)
            )
            # Would need to look up symbol - simplified for now
            from src.models.db import Symbol
            sym_result = await self.session.execute(
                select(Symbol.id).where(Symbol.symbol == decision.action.symbol)
            )
            symbol_id = sym_result.scalar_one_or_none()

        record = AgentDecision(
            agent_id=agent_id,
            action=decision.action.action.value,
            symbol_id=symbol_id,
            reasoning_full=decision.reasoning_full,
            reasoning_summary=decision.reasoning_summary,
            action_params={
                "symbol": decision.action.symbol,
                "position_size_pct": decision.action.position_size_pct,
                "stop_loss_pct": decision.action.stop_loss_pct,
                "take_profit_pct": decision.action.take_profit_pct,
                "confidence": decision.action.confidence,
            },
            model_used=decision.model_used,
            input_tokens=decision.input_tokens,
            output_tokens=decision.output_tokens,
            estimated_cost_usd=decision.estimated_cost_usd,
            prompt_version=decision.prompt_version,
            decided_at=decision.decided_at,
        )
        self.session.add(record)
        await self.session.flush()

        return record

    async def _track_token_usage(
        self,
        agent_id: int,
        model: str,
        task_type: str,
        input_tokens: int,
        output_tokens: int,
        cost: Decimal,
    ) -> None:
        """Track token usage for an agent."""
        today = date.today()

        # Upsert token usage record
        stmt = insert(AgentTokenUsage).values(
            agent_id=agent_id,
            model=model,
            task_type=task_type,
            date=today,
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
