"""Rule-based executor for agent decisions.

Replaces Claude API calls with deterministic Python strategy logic.
Produces the same AgentDecisionResult so all downstream code is reused.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from src.agents.schemas import (
    ActionType,
    AgentContext,
    AgentDecisionResult,
    TradeAction,
)
from src.agents.strategies import STRATEGY_REGISTRY, CROSS_TF_STRATEGY_REGISTRY
from src.agents.strategies.base import BaseRuleStrategy

logger = logging.getLogger(__name__)


class RuleBasedExecutor:
    """Executes rule-based agent decisions using Python strategy classes."""

    def get_strategy(self, agent_name: str, strategy_archetype: str) -> BaseRuleStrategy:
        """Look up the correct strategy class for an agent."""
        if agent_name in CROSS_TF_STRATEGY_REGISTRY:
            return CROSS_TF_STRATEGY_REGISTRY[agent_name]()
        if strategy_archetype in STRATEGY_REGISTRY:
            return STRATEGY_REGISTRY[strategy_archetype]()
        raise ValueError(
            f"No strategy for agent={agent_name}, archetype={strategy_archetype}"
        )

    async def decide(
        self,
        context: AgentContext,
        agent_name: str,
        strategy_archetype: str,
        prompt_version: int,
    ) -> AgentDecisionResult:
        """Run the rule-based strategy and return a decision.

        Returns AgentDecisionResult with zero tokens and zero cost.
        """
        strategy = self.get_strategy(agent_name, strategy_archetype)

        try:
            action: TradeAction = strategy.evaluate(context)
        except Exception as e:
            logger.exception(f"Rule strategy error for {agent_name}: {e}")
            action = TradeAction(action=ActionType.HOLD, confidence=0.0)

        try:
            reasoning = strategy.generate_reasoning(context, action)
        except Exception:
            reasoning = f"Rule-based decision: {action.action.value}"

        reasoning_summary = reasoning[:500] if len(reasoning) > 500 else reasoning

        return AgentDecisionResult(
            action=action,
            reasoning_full=reasoning,
            reasoning_summary=reasoning_summary,
            model_used="rule_engine",
            input_tokens=0,
            output_tokens=0,
            estimated_cost_usd=Decimal("0.0000"),
            prompt_version=prompt_version,
            decided_at=datetime.now(timezone.utc),
        )
