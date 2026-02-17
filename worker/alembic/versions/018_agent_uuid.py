"""Add UUID column to agents table.

Revision ID: 018
Revises: 017
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add uuid column with default
    op.add_column(
        "agents",
        sa.Column(
            "uuid",
            UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
    )
    op.create_unique_constraint("uq_agents_uuid", "agents", ["uuid"])
    op.create_index("ix_agents_uuid", "agents", ["uuid"])


def downgrade() -> None:
    op.drop_index("ix_agents_uuid", table_name="agents")
    op.drop_constraint("uq_agents_uuid", "agents", type_="unique")
    op.drop_column("agents", "uuid")
