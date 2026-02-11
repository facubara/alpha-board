"""Rule-based trading strategy registry."""

from src.agents.strategies.base import BaseRuleStrategy
from src.agents.strategies.momentum import MomentumStrategy
from src.agents.strategies.mean_reversion import MeanReversionStrategy
from src.agents.strategies.breakout import BreakoutStrategy
from src.agents.strategies.swing import SwingStrategy
from src.agents.strategies.cross_confluence import CrossConfluenceStrategy
from src.agents.strategies.cross_divergence import CrossDivergenceStrategy
from src.agents.strategies.cross_cascade import CrossCascadeStrategy
from src.agents.strategies.cross_regime import CrossRegimeStrategy

# Archetype → strategy class (for timeframe-specific agents)
STRATEGY_REGISTRY: dict[str, type[BaseRuleStrategy]] = {
    "momentum": MomentumStrategy,
    "mean_reversion": MeanReversionStrategy,
    "breakout": BreakoutStrategy,
    "swing": SwingStrategy,
}

# Agent name → strategy class (for cross-TF agents)
CROSS_TF_STRATEGY_REGISTRY: dict[str, type[BaseRuleStrategy]] = {
    "rb-cross-confluence": CrossConfluenceStrategy,
    "rb-cross-divergence": CrossDivergenceStrategy,
    "rb-cross-cascade": CrossCascadeStrategy,
    "rb-cross-regime": CrossRegimeStrategy,
}

__all__ = [
    "BaseRuleStrategy",
    "STRATEGY_REGISTRY",
    "CROSS_TF_STRATEGY_REGISTRY",
    "MomentumStrategy",
    "MeanReversionStrategy",
    "BreakoutStrategy",
    "SwingStrategy",
    "CrossConfluenceStrategy",
    "CrossDivergenceStrategy",
    "CrossCascadeStrategy",
    "CrossRegimeStrategy",
]
