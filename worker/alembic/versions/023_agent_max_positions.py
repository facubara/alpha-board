"""Add max_positions column to agents table.

Per-agent configurable position limit. Replaces hardcoded caps
in strategies and portfolio manager.

Revision ID: 023
Revises: 022
"""

from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column(
            "max_positions",
            sa.SmallInteger,
            nullable=False,
            server_default="5",
        ),
    )


def downgrade() -> None:
    op.drop_column("agents", "max_positions")
