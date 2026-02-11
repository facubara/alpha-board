"""Pydantic event models for notification payloads."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class TradeOpenedEvent(BaseModel):
    """Fired when an agent opens a new position."""

    agent_name: str
    engine: str  # "llm" or "rule"
    agent_id: int
    symbol: str
    direction: str  # "long" or "short"
    entry_price: Decimal
    position_size: Decimal
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    confidence: float | None = None


class TradeClosedEvent(BaseModel):
    """Fired when a trade is closed (agent decision, SL, or TP)."""

    agent_name: str
    engine: str
    agent_id: int
    symbol: str
    direction: str
    entry_price: Decimal
    exit_price: Decimal
    pnl: Decimal
    pnl_pct: float
    position_size: Decimal
    duration_minutes: int
    exit_reason: str  # "agent_decision", "stop_loss", "take_profit"


class EquityAlertEvent(BaseModel):
    """Fired for equity milestones or drawdown alerts."""

    alert_type: str  # "high", "low", "drawdown"
    agent_name: str
    engine: str
    agent_id: int
    equity: Decimal
    return_pct: float
    drawdown_pct: float | None = None
    peak_equity: Decimal | None = None


class EvolutionEvent(BaseModel):
    """Fired when an agent's prompt evolves or reverts."""

    agent_name: str
    engine: str
    agent_id: int
    event_type: str  # "evolved" or "reverted"
    old_version: int | None = None
    new_version: int | None = None


class DailyDigestData(BaseModel):
    """Aggregated data for the daily digest message."""

    date: str
    total_agents: int
    active_agents: int
    total_trades_today: int
    winning_trades: int
    losing_trades: int
    total_pnl: Decimal
    best_agent_name: str | None = None
    best_agent_pnl: Decimal | None = None
    worst_agent_name: str | None = None
    worst_agent_pnl: Decimal | None = None
    total_equity: Decimal = Field(default=Decimal("0.00"))
    open_positions: int = 0
    evolutions_today: int = 0
