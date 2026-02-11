"""Add notification preferences table and equity tracking columns.

Creates notification_preferences single-row table for Telegram notification
settings and adds peak_equity/trough_equity to agent_portfolios for
drawdown alert detection.

Revision ID: 007
Revises: 006
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create notification_preferences table (single-row config)
    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "engine_filter",
            sa.String(10),
            nullable=False,
            server_default="all",
        ),
        sa.Column("notify_trade_opened", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notify_trade_closed", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notify_sl_tp", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notify_daily_digest", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notify_equity_alerts", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notify_evolution", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "drawdown_alert_threshold",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="10.00",
        ),
        sa.Column("muted_agent_ids", JSONB, nullable=False, server_default="[]"),
        sa.Column("quiet_hours_start", sa.Integer, nullable=True),
        sa.Column("quiet_hours_end", sa.Integer, nullable=True),
    )

    # Insert default preferences row
    op.execute(
        "INSERT INTO notification_preferences (id) VALUES (1)"
    )

    # Add peak/trough equity columns to agent_portfolios
    op.add_column(
        "agent_portfolios",
        sa.Column(
            "peak_equity",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="10000.00",
        ),
    )
    op.add_column(
        "agent_portfolios",
        sa.Column(
            "trough_equity",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="10000.00",
        ),
    )

    # Initialize peak/trough from current equity
    op.execute(
        "UPDATE agent_portfolios SET peak_equity = total_equity, trough_equity = total_equity"
    )


def downgrade() -> None:
    op.drop_column("agent_portfolios", "trough_equity")
    op.drop_column("agent_portfolios", "peak_equity")
    op.drop_table("notification_preferences")
