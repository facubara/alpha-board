"""Pydantic models for the agent system.

Defines data structures for:
- Agent actions and decisions
- Context passed to Claude
- Portfolio state and performance
- Trade execution parameters
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# =============================================================================
# Enums
# =============================================================================


class ActionType(str, Enum):
    """Possible agent actions."""

    OPEN_LONG = "open_long"
    OPEN_SHORT = "open_short"
    CLOSE = "close"
    HOLD = "hold"


class Direction(str, Enum):
    """Position direction."""

    LONG = "long"
    SHORT = "short"


# =============================================================================
# Trade Action (Tool Output from Claude)
# =============================================================================


class TradeAction(BaseModel):
    """Action returned by Claude via tool_use.

    This matches the tool schema defined for the agent.
    """

    action: ActionType
    symbol: str | None = None
    position_size_pct: float | None = Field(
        default=None,
        ge=0.01,
        le=0.25,
        description="Position size as percentage of portfolio (1-25%)",
    )
    stop_loss_pct: float | None = Field(
        default=None,
        ge=0.01,
        le=0.20,
        description="Stop loss percentage (1-20%)",
    )
    take_profit_pct: float | None = Field(
        default=None,
        ge=0.01,
        le=0.50,
        description="Take profit percentage (1-50%)",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Agent's confidence in this action (0-1)",
    )


# =============================================================================
# Agent Decision (Full Response)
# =============================================================================


class AgentDecisionResult(BaseModel):
    """Complete decision from an agent including reasoning."""

    action: TradeAction
    reasoning_full: str = Field(description="Full reasoning from Claude")
    reasoning_summary: str = Field(
        max_length=500, description="Concise summary of reasoning"
    )
    model_used: str
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: Decimal
    prompt_version: int
    decided_at: datetime = Field(default_factory=lambda: datetime.now())


# =============================================================================
# Portfolio Models
# =============================================================================


class PositionInfo(BaseModel):
    """Information about an open position."""

    id: int
    symbol: str
    symbol_id: int
    direction: Direction
    entry_price: Decimal
    position_size: Decimal
    stop_loss: Decimal | None
    take_profit: Decimal | None
    opened_at: datetime
    unrealized_pnl: Decimal
    current_price: Decimal | None = None
    pnl_pct: float | None = None


class PortfolioSummary(BaseModel):
    """Summary of agent's portfolio state."""

    agent_id: int
    cash_balance: Decimal
    total_equity: Decimal
    total_realized_pnl: Decimal
    total_fees_paid: Decimal
    open_positions: list[PositionInfo]
    position_count: int
    max_positions: int = 5
    available_for_new_position: Decimal  # Cash available considering constraints


class PerformanceStats(BaseModel):
    """Agent performance statistics."""

    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_pnl: Decimal
    avg_pnl_per_trade: Decimal
    max_drawdown: float
    sharpe_ratio: float | None = None
    avg_trade_duration_hours: float | None = None


# =============================================================================
# Context Models (Input to Claude)
# =============================================================================


class RankingContext(BaseModel):
    """Ranking data for context."""

    symbol: str
    rank: int
    bullish_score: float
    confidence: int
    highlights: list[dict[str, Any]]
    indicator_signals: list[dict[str, Any]]


class MarketContext(BaseModel):
    """Market data context for a symbol."""

    symbol: str
    current_price: Decimal
    price_change_24h_pct: float
    volume_24h_usd: Decimal
    high_24h: Decimal
    low_24h: Decimal


class TimeframeContext(BaseModel):
    """Context for a specific timeframe."""

    timeframe: str
    rankings: list[RankingContext]
    computed_at: datetime | None


class RegimeLabel(BaseModel):
    """Persisted regime classification for a single timeframe."""

    timeframe: str
    regime: str  # "trending_bull", "trending_bear", "ranging", "volatile"
    confidence: float
    avg_bullish_score: float
    computed_at: datetime


class CrossTimeframeContext(BaseModel):
    """Aggregated regime data across all timeframes."""

    regimes: dict[str, RegimeLabel]  # {tf: label}
    higher_tf_trend: str | None = None  # "bull", "bear", "mixed", "ranging"
    higher_tf_confidence: float = 0.0  # 0-100


class TweetSignalContext(BaseModel):
    """A single tweet signal for agent consumption."""

    handle: str
    category: str  # analyst, founder, degen, etc.
    text: str
    sentiment_score: float  # -1 to +1
    setup_type: str
    confidence: float
    symbols_mentioned: list[str]
    reasoning: str
    likes: int
    retweets: int
    tweeted_at: datetime


class TweetContext(BaseModel):
    """Aggregated tweet context for agent decision-making."""

    signals: list[TweetSignalContext]
    avg_sentiment: float
    bullish_count: int
    bearish_count: int
    most_mentioned_symbols: list[str]  # top 5 by frequency
    lookback_hours: float  # how far back we looked


class AgentContext(BaseModel):
    """Full context passed to Claude for decision-making."""

    # Agent info
    agent_id: int
    agent_name: str
    strategy_archetype: str
    primary_timeframe: str

    # Portfolio state
    portfolio: PortfolioSummary
    performance: PerformanceStats

    # Market data
    primary_timeframe_rankings: list[RankingContext]
    cross_timeframe_confluence: dict[str, Any] | None = None

    # Regime context
    cross_timeframe_regime: CrossTimeframeContext | None = None

    # Tweet context (for tweet/hybrid agents)
    tweet_context: TweetContext | None = None

    # Current prices for open positions
    current_prices: dict[str, Decimal]

    # Memory (recent lessons)
    recent_memory: list[str] = Field(default_factory=list)

    # Fleet lessons (from discarded agents of same archetype)
    fleet_lessons: list[str] = Field(default_factory=list)

    # Timestamp
    context_built_at: datetime = Field(default_factory=lambda: datetime.now())


# =============================================================================
# Validation Result
# =============================================================================


class ValidationResult(BaseModel):
    """Result of validating an action."""

    is_valid: bool
    error_message: str | None = None
    warnings: list[str] = Field(default_factory=list)


# =============================================================================
# Execution Result
# =============================================================================


class ExecutionResult(BaseModel):
    """Result of executing an action."""

    success: bool
    action: ActionType
    symbol: str | None = None
    position_id: int | None = None
    trade_id: int | None = None
    error_message: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
