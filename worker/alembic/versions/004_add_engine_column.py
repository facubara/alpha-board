"""Add engine column to agents table.

Revision ID: 004
Revises: 003
Create Date: 2026-02-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add engine column with default 'llm' for existing agents
    op.add_column(
        "agents",
        sa.Column("engine", sa.String(10), nullable=False, server_default="llm"),
    )
    # Index for filtered queries (engine + timeframe + status)
    op.create_index(
        "idx_agents_engine_tf_status",
        "agents",
        ["engine", "timeframe", "status"],
    )


def downgrade() -> None:
    op.drop_index("idx_agents_engine_tf_status", table_name="agents")
    op.drop_column("agents", "engine")
