"""Agent system for Alpha Board.

Components:
- schemas: Pydantic models for actions, decisions, context
- context: ContextBuilder for assembling agent context
- executor: AgentExecutor for Claude API calls
- portfolio: PortfolioManager for position management
- orchestrator: AgentOrchestrator for running agent cycles
"""

from src.agents.schemas import (
    ActionType,
    AgentContext,
    AgentDecisionResult,
    Direction,
    ExecutionResult,
    PerformanceStats,
    PortfolioSummary,
    PositionInfo,
    TradeAction,
    ValidationResult,
)
from src.agents.context import ContextBuilder
from src.agents.executor import AgentExecutor, estimate_cost
from src.agents.portfolio import PortfolioManager
from src.agents.orchestrator import AgentOrchestrator
from src.agents.memory import MemoryManager
from src.agents.evolution import EvolutionManager

__all__ = [
    # Schemas
    "ActionType",
    "AgentContext",
    "AgentDecisionResult",
    "Direction",
    "ExecutionResult",
    "PerformanceStats",
    "PortfolioSummary",
    "PositionInfo",
    "TradeAction",
    "ValidationResult",
    # Classes
    "ContextBuilder",
    "AgentExecutor",
    "PortfolioManager",
    "AgentOrchestrator",
    "MemoryManager",
    "EvolutionManager",
    # Functions
    "estimate_cost",
]
