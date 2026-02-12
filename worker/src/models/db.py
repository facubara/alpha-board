"""SQLAlchemy ORM models for Alpha Board.

Tables:
1. symbols — Active trading pairs
2. indicators — Indicator registry with weights
3. computation_runs — Pipeline run tracking
4. snapshots — Ranking data (partitioned by month)
5. agents — Agent registry
6. agent_prompts — Prompt version history
7. agent_portfolios — Current portfolio state
8. agent_positions — Open positions
9. agent_trades — Completed trades
10. agent_decisions — Decision log (partitioned by month)
11. agent_memory — Memory bank
12. agent_token_usage — Token usage tracking
"""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func

if TYPE_CHECKING:
    pass


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


# =============================================================================
# Core Ranking Tables
# =============================================================================


class Symbol(Base):
    """Active trading pairs from Binance."""

    __tablename__ = "symbols"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    base_asset: Mapped[str] = mapped_column(String(20), nullable=False)
    quote_asset: Mapped[str] = mapped_column(String(10), nullable=False, default="USDT")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    snapshots: Mapped[list["Snapshot"]] = relationship(back_populates="symbol")
    positions: Mapped[list["AgentPosition"]] = relationship(back_populates="symbol")
    trades: Mapped[list["AgentTrade"]] = relationship(back_populates="symbol")
    decisions: Mapped[list["AgentDecision"]] = relationship(back_populates="symbol")


class Indicator(Base):
    """Registry of technical indicators with weights."""

    __tablename__ = "indicators"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False, default=Decimal("0.10"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class ComputationRun(Base):
    """Tracks pipeline computation runs."""

    __tablename__ = "computation_runs"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    timeframe: Mapped[str] = mapped_column(String(4), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    symbol_count: Mapped[int | None] = mapped_column(SmallInteger)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="running")
    error_message: Mapped[str | None] = mapped_column(Text)

    # Relationships
    snapshots: Mapped[list["Snapshot"]] = relationship(back_populates="run")


class Snapshot(Base):
    """Ranking snapshot per symbol per timeframe per run.

    Partitioned by month on computed_at. Partitions are created via migration.
    """

    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    symbol_id: Mapped[int] = mapped_column(Integer, ForeignKey("symbols.id"), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(4), nullable=False)
    bullish_score: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    confidence: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    rank: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    highlights: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    indicator_signals: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    computed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), primary_key=True
    )
    run_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("computation_runs.id"), nullable=False
    )

    # Relationships
    symbol: Mapped["Symbol"] = relationship(back_populates="snapshots")
    run: Mapped["ComputationRun"] = relationship(back_populates="snapshots")

    __table_args__ = (
        Index("idx_snapshots_tf_time", "timeframe", computed_at.desc()),
        Index("idx_snapshots_symbol_tf_time", "symbol_id", "timeframe", computed_at.desc()),
        Index("idx_snapshots_run", "run_id"),
        {"postgresql_partition_by": "RANGE (computed_at)"},
    )


class TimeframeRegime(Base):
    """Persisted regime classification per timeframe. One row per TF, upserted."""

    __tablename__ = "timeframe_regimes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timeframe: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    regime: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    avg_bullish_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 3))
    avg_adx: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    avg_bandwidth: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    symbols_analyzed: Mapped[int | None] = mapped_column(Integer)
    computed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


# =============================================================================
# Agent Tables
# =============================================================================


class Agent(Base):
    """Core agent registry."""

    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    strategy_archetype: Mapped[str] = mapped_column(String(20), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    scan_model: Mapped[str] = mapped_column(
        String(50), nullable=False, default="claude-haiku-3-5-20241022"
    )
    trade_model: Mapped[str] = mapped_column(
        String(50), nullable=False, default="claude-sonnet-4-20250514"
    )
    evolution_model: Mapped[str] = mapped_column(
        String(50), nullable=False, default="claude-opus-4-5-20251101"
    )
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="active")
    engine: Mapped[str] = mapped_column(String(10), nullable=False, default="llm")
    initial_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("10000.00")
    )
    evolution_trade_threshold: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=10)
    last_cycle_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    prompts: Mapped[list["AgentPrompt"]] = relationship(back_populates="agent")
    portfolio: Mapped["AgentPortfolio"] = relationship(back_populates="agent", uselist=False)
    positions: Mapped[list["AgentPosition"]] = relationship(back_populates="agent")
    trades: Mapped[list["AgentTrade"]] = relationship(back_populates="agent")
    decisions: Mapped[list["AgentDecision"]] = relationship(back_populates="agent")
    memories: Mapped[list["AgentMemory"]] = relationship(back_populates="agent")
    token_usage: Mapped[list["AgentTokenUsage"]] = relationship(back_populates="agent")


class AgentPrompt(Base):
    """Immutable prompt version history."""

    __tablename__ = "agent_prompts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agents.id"), nullable=False)
    version: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(10), nullable=False)  # 'initial', 'auto', 'human'
    diff_from_previous: Mapped[str | None] = mapped_column(Text)
    performance_at_change: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    agent: Mapped["Agent"] = relationship(back_populates="prompts")

    __table_args__ = (
        UniqueConstraint("agent_id", "version", name="uq_agent_prompts_agent_version"),
        Index("idx_agent_prompts_active", "agent_id", postgresql_where=(is_active == True)),  # noqa: E712
    )


class AgentPortfolio(Base):
    """Current portfolio state per agent. Updated in place."""

    __tablename__ = "agent_portfolios"

    agent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("agents.id"), primary_key=True, nullable=False
    )
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    total_equity: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    total_realized_pnl: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    total_fees_paid: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    peak_equity: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("10000.00")
    )
    trough_equity: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("10000.00")
    )

    # Relationships
    agent: Mapped["Agent"] = relationship(back_populates="portfolio")


class AgentPosition(Base):
    """Open positions. Rows deleted when positions close."""

    __tablename__ = "agent_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agents.id"), nullable=False)
    symbol_id: Mapped[int] = mapped_column(Integer, ForeignKey("symbols.id"), nullable=False)
    direction: Mapped[str] = mapped_column(String(5), nullable=False)  # 'long' or 'short'
    entry_price: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    position_size: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    stop_loss: Mapped[Decimal | None] = mapped_column(Numeric(18, 8))
    take_profit: Mapped[Decimal | None] = mapped_column(Numeric(18, 8))
    opened_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    unrealized_pnl: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )

    # Relationships
    agent: Mapped["Agent"] = relationship(back_populates="positions")
    symbol: Mapped["Symbol"] = relationship(back_populates="positions")

    __table_args__ = (Index("idx_agent_positions_agent", "agent_id"),)


class AgentTrade(Base):
    """Immutable record of completed trades."""

    __tablename__ = "agent_trades"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agents.id"), nullable=False)
    symbol_id: Mapped[int] = mapped_column(Integer, ForeignKey("symbols.id"), nullable=False)
    direction: Mapped[str] = mapped_column(String(5), nullable=False)
    entry_price: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    exit_price: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    position_size: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    pnl: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    fees: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    exit_reason: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'agent_decision', 'stop_loss', 'take_profit'
    opened_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    closed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    decision_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("agent_decisions.id"))
    close_decision_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("agent_decisions.id")
    )

    # Relationships
    agent: Mapped["Agent"] = relationship(back_populates="trades")
    symbol: Mapped["Symbol"] = relationship(back_populates="trades")
    memory: Mapped["AgentMemory"] = relationship(back_populates="trade", uselist=False)

    __table_args__ = (Index("idx_agent_trades_agent_time", "agent_id", closed_at.desc()),)


class AgentDecision(Base):
    """Every decision an agent makes, including 'hold'.

    Partitioned by month on decided_at. Partitions created via migration.
    """

    __tablename__ = "agent_decisions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agents.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    symbol_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("symbols.id"))
    reasoning_full: Mapped[str] = mapped_column(Text, nullable=False)
    reasoning_summary: Mapped[str] = mapped_column(String(500), nullable=False)
    action_params: Mapped[dict | None] = mapped_column(JSONB)
    model_used: Mapped[str] = mapped_column(String(50), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    prompt_version: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    decided_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), primary_key=True
    )

    # Relationships
    agent: Mapped["Agent"] = relationship(back_populates="decisions")
    symbol: Mapped["Symbol"] = relationship(back_populates="decisions")

    __table_args__ = (
        Index("idx_agent_decisions_agent_time", "agent_id", decided_at.desc()),
        {"postgresql_partition_by": "RANGE (decided_at)"},
    )


class AgentMemory(Base):
    """Append-only memory bank for agent learning."""

    __tablename__ = "agent_memory"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agents.id"), nullable=False)
    trade_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("agent_trades.id"), nullable=False)
    lesson: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    agent: Mapped["Agent"] = relationship(back_populates="memories")
    trade: Mapped["AgentTrade"] = relationship(back_populates="memory")

    __table_args__ = (Index("idx_agent_memory_agent_time", "agent_id", created_at.desc()),)


class AgentTokenUsage(Base):
    """Aggregated token usage per agent per model per day."""

    __tablename__ = "agent_token_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agents.id"), nullable=False)
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    task_type: Mapped[str] = mapped_column(String(15), nullable=False)  # 'scan', 'trade', 'evolution'
    date: Mapped[date] = mapped_column(Date, nullable=False)
    input_tokens: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=Decimal("0.0000")
    )

    # Relationships
    agent: Mapped["Agent"] = relationship(back_populates="token_usage")

    __table_args__ = (
        UniqueConstraint(
            "agent_id", "model", "task_type", "date", name="uq_agent_token_usage_agent_model_task_date"
        ),
        Index("idx_agent_token_usage_agent_date", "agent_id", date.desc()),
    )


# =============================================================================
# Notification Tables
# =============================================================================


class NotificationPreference(Base):
    """Single-row notification preferences for Telegram alerts."""

    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    engine_filter: Mapped[str] = mapped_column(String(10), nullable=False, default="all")
    notify_trade_opened: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_trade_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_sl_tp: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_daily_digest: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_equity_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_evolution: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    drawdown_alert_threshold: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("10.00")
    )
    muted_agent_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    quiet_hours_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quiet_hours_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
