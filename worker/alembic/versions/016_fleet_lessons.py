"""Create fleet_lessons table for post-mortem analysis.

Revision ID: 016
Revises: 015
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fleet_lessons",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("agent_id", sa.Integer, sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("archetype", sa.String(50), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("lesson", sa.Text, nullable=False),
        sa.Column("context", JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_fleet_lessons_archetype", "fleet_lessons", ["archetype"])
    op.create_index("ix_fleet_lessons_active", "fleet_lessons", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_fleet_lessons_active")
    op.drop_index("ix_fleet_lessons_archetype")
    op.drop_table("fleet_lessons")
