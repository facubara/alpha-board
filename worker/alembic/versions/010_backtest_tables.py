"""Add backtest_runs and backtest_trades tables.

Revision ID: 010
Revises: 009
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("agent_name", sa.String(50), nullable=False),
        sa.Column("strategy_archetype", sa.String(20), nullable=False),
        sa.Column("timeframe", sa.String(10), nullable=False),
        sa.Column("symbol", sa.String(30), nullable=False),
        sa.Column("start_date", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("end_date", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "initial_balance",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="10000.00",
        ),
        sa.Column("final_equity", sa.Numeric(14, 2), nullable=True),
        sa.Column("total_pnl", sa.Numeric(14, 2), nullable=True),
        sa.Column("total_trades", sa.Integer, server_default="0"),
        sa.Column("winning_trades", sa.Integer, server_default="0"),
        sa.Column("max_drawdown_pct", sa.Numeric(8, 4), nullable=True),
        sa.Column("sharpe_ratio", sa.Numeric(8, 4), nullable=True),
        sa.Column("equity_curve", JSONB, nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_table(
        "backtest_trades",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "run_id",
            sa.Integer,
            sa.ForeignKey("backtest_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("symbol", sa.String(30), nullable=False),
        sa.Column("direction", sa.String(5), nullable=False),
        sa.Column("entry_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("exit_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("position_size", sa.Numeric(14, 2), nullable=False),
        sa.Column("pnl", sa.Numeric(14, 2), nullable=False),
        sa.Column("fees", sa.Numeric(10, 2), nullable=False),
        sa.Column("exit_reason", sa.String(20), nullable=False),
        sa.Column("entry_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("exit_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer, nullable=False),
    )

    op.create_index("idx_backtest_runs_status", "backtest_runs", ["status"])
    op.create_index("idx_backtest_trades_run", "backtest_trades", ["run_id"])


def downgrade() -> None:
    op.drop_index("idx_backtest_trades_run")
    op.drop_index("idx_backtest_runs_status")
    op.drop_table("backtest_trades")
    op.drop_table("backtest_runs")
