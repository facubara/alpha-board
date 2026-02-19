"""Add exchange_settings and trade_executions tables.

Revision ID: 021
Revises: 020
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exchange_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("encrypted_api_key", sa.Text, nullable=True),
        sa.Column("encrypted_api_secret", sa.Text, nullable=True),
        sa.Column("trading_mode", sa.String(10), nullable=False, server_default="futures"),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("default_leverage", sa.Integer, nullable=False, server_default="1"),
        sa.Column("max_position_usd", sa.Numeric(14, 2), nullable=False, server_default="100.00"),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("id = 1", name="ck_exchange_settings_single_row"),
    )

    op.create_table(
        "trade_executions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("symbol", sa.String(30), nullable=False),
        sa.Column("direction", sa.String(5), nullable=False),
        sa.Column("market", sa.String(10), nullable=False),
        sa.Column("quote_qty", sa.Numeric(14, 2), nullable=False),
        sa.Column("leverage", sa.Integer, nullable=True),
        sa.Column("binance_order_id", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("response", JSONB, nullable=True),
        sa.Column(
            "executed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("trade_executions")
    op.drop_table("exchange_settings")
