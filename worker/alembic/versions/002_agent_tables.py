"""Agent tables: agents, prompts, portfolios, positions, trades, decisions, memory, token_usage.

Revision ID: 002
Revises: 001
Create Date: 2026-02-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==========================================================================
    # agents table
    # ==========================================================================
    op.create_table(
        "agents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("strategy_archetype", sa.String(20), nullable=False),
        sa.Column("timeframe", sa.String(10), nullable=False),
        sa.Column(
            "scan_model", sa.String(50), nullable=False, server_default="claude-haiku-3-5-20241022"
        ),
        sa.Column(
            "trade_model", sa.String(50), nullable=False, server_default="claude-sonnet-4-20250514"
        ),
        sa.Column(
            "evolution_model",
            sa.String(50),
            nullable=False,
            server_default="claude-opus-4-5-20251101",
        ),
        sa.Column("status", sa.String(10), nullable=False, server_default="active"),
        sa.Column("initial_balance", sa.Numeric(12, 2), nullable=False, server_default="10000.00"),
        sa.Column("evolution_trade_threshold", sa.SmallInteger(), nullable=False, server_default="10"),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )

    # ==========================================================================
    # agent_prompts table
    # ==========================================================================
    op.create_table(
        "agent_prompts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("version", sa.SmallInteger(), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("source", sa.String(10), nullable=False),  # 'initial', 'auto', 'human'
        sa.Column("diff_from_previous", sa.Text()),
        sa.Column("performance_at_change", postgresql.JSONB()),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint("agent_id", "version", name="uq_agent_prompts_agent_version"),
    )

    op.create_index(
        "idx_agent_prompts_active",
        "agent_prompts",
        ["agent_id"],
        postgresql_where=sa.text("is_active = true"),
    )

    # ==========================================================================
    # agent_portfolios table
    # ==========================================================================
    op.create_table(
        "agent_portfolios",
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), primary_key=True),
        sa.Column("cash_balance", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_equity", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_realized_pnl", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("total_fees_paid", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column(
            "updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )

    # ==========================================================================
    # agent_positions table
    # ==========================================================================
    op.create_table(
        "agent_positions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("symbol_id", sa.Integer(), sa.ForeignKey("symbols.id"), nullable=False),
        sa.Column("direction", sa.String(5), nullable=False),  # 'long' or 'short'
        sa.Column("entry_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("position_size", sa.Numeric(14, 2), nullable=False),
        sa.Column("stop_loss", sa.Numeric(18, 8)),
        sa.Column("take_profit", sa.Numeric(18, 8)),
        sa.Column(
            "opened_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("unrealized_pnl", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
    )

    op.create_index("idx_agent_positions_agent", "agent_positions", ["agent_id"])

    # ==========================================================================
    # agent_decisions table (partitioned by month on decided_at)
    # Must be created before agent_trades due to FK reference
    # ==========================================================================
    op.execute(
        """
        CREATE TABLE agent_decisions (
            id BIGSERIAL,
            agent_id INT NOT NULL REFERENCES agents(id),
            action VARCHAR(20) NOT NULL,
            symbol_id INT REFERENCES symbols(id),
            reasoning_full TEXT NOT NULL,
            reasoning_summary VARCHAR(500) NOT NULL,
            action_params JSONB,
            model_used VARCHAR(50) NOT NULL,
            input_tokens INT NOT NULL,
            output_tokens INT NOT NULL,
            estimated_cost_usd NUMERIC(8,4) NOT NULL,
            prompt_version SMALLINT NOT NULL,
            decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id, decided_at)
        ) PARTITION BY RANGE (decided_at);
        """
    )

    # Create partitions for 2026-02 through 2026-04
    op.execute(
        """
        CREATE TABLE agent_decisions_2026_02 PARTITION OF agent_decisions
            FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
        """
    )
    op.execute(
        """
        CREATE TABLE agent_decisions_2026_03 PARTITION OF agent_decisions
            FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
        """
    )
    op.execute(
        """
        CREATE TABLE agent_decisions_2026_04 PARTITION OF agent_decisions
            FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
        """
    )

    op.create_index(
        "idx_agent_decisions_agent_time",
        "agent_decisions",
        ["agent_id", sa.text("decided_at DESC")],
    )

    # ==========================================================================
    # agent_trades table
    # Note: FKs to agent_decisions are not enforced since it's partitioned
    # ==========================================================================
    op.create_table(
        "agent_trades",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("symbol_id", sa.Integer(), sa.ForeignKey("symbols.id"), nullable=False),
        sa.Column("direction", sa.String(5), nullable=False),
        sa.Column("entry_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("exit_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("position_size", sa.Numeric(14, 2), nullable=False),
        sa.Column("pnl", sa.Numeric(14, 2), nullable=False),
        sa.Column("fees", sa.Numeric(10, 2), nullable=False),
        sa.Column("exit_reason", sa.String(20), nullable=False),
        sa.Column("opened_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "closed_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("decision_id", sa.BigInteger()),  # No FK to partitioned table
        sa.Column("close_decision_id", sa.BigInteger()),  # No FK to partitioned table
    )

    op.create_index(
        "idx_agent_trades_agent_time", "agent_trades", ["agent_id", sa.text("closed_at DESC")]
    )

    # ==========================================================================
    # agent_memory table
    # ==========================================================================
    op.create_table(
        "agent_memory",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("trade_id", sa.BigInteger(), sa.ForeignKey("agent_trades.id"), nullable=False),
        sa.Column("lesson", sa.Text(), nullable=False),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )

    op.create_index(
        "idx_agent_memory_agent_time", "agent_memory", ["agent_id", sa.text("created_at DESC")]
    )

    # ==========================================================================
    # agent_token_usage table
    # ==========================================================================
    op.create_table(
        "agent_token_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("model", sa.String(50), nullable=False),
        sa.Column("task_type", sa.String(15), nullable=False),  # 'scan', 'trade', 'evolution'
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("input_tokens", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Numeric(10, 4), nullable=False, server_default="0.0000"),
        sa.UniqueConstraint(
            "agent_id", "model", "task_type", "date", name="uq_agent_token_usage_agent_model_task_date"
        ),
    )

    op.create_index(
        "idx_agent_token_usage_agent_date", "agent_token_usage", ["agent_id", sa.text("date DESC")]
    )


def downgrade() -> None:
    op.drop_index("idx_agent_token_usage_agent_date", table_name="agent_token_usage")
    op.drop_table("agent_token_usage")

    op.drop_index("idx_agent_memory_agent_time", table_name="agent_memory")
    op.drop_table("agent_memory")

    op.drop_index("idx_agent_trades_agent_time", table_name="agent_trades")
    op.drop_table("agent_trades")

    op.drop_index("idx_agent_decisions_agent_time", table_name="agent_decisions")
    op.execute("DROP TABLE IF EXISTS agent_decisions_2026_04")
    op.execute("DROP TABLE IF EXISTS agent_decisions_2026_03")
    op.execute("DROP TABLE IF EXISTS agent_decisions_2026_02")
    op.execute("DROP TABLE IF EXISTS agent_decisions")

    op.drop_index("idx_agent_positions_agent", table_name="agent_positions")
    op.drop_table("agent_positions")

    op.drop_table("agent_portfolios")

    op.drop_index("idx_agent_prompts_active", table_name="agent_prompts")
    op.drop_table("agent_prompts")

    op.drop_table("agents")
