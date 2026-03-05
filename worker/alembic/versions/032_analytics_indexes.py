"""Add analytics performance indexes.

Standalone indexes for time-windowed analytics queries that don't filter by agent_id.

Revision ID: 032
Revises: 031
Create Date: 2026-03-05
"""

import sqlalchemy as sa
from alembic import op

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_agent_trades_closed_at",
        "agent_trades",
        [sa.text("closed_at DESC")],
    )
    op.create_index(
        "idx_agent_trades_symbol",
        "agent_trades",
        ["symbol_id"],
    )
    op.create_index(
        "idx_agent_token_usage_date",
        "agent_token_usage",
        [sa.text("date DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_agent_token_usage_date", table_name="agent_token_usage")
    op.drop_index("idx_agent_trades_symbol", table_name="agent_trades")
    op.drop_index("idx_agent_trades_closed_at", table_name="agent_trades")
