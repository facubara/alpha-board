"""Add discard columns to agents for auto-pruning.

Revision ID: 015
Revises: 014
"""

from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Widen status column to fit 'discarded' (was varchar(10))
    op.alter_column(
        "agents",
        "status",
        type_=sa.String(20),
        existing_type=sa.String(10),
        existing_nullable=False,
    )
    op.add_column(
        "agents",
        sa.Column("discarded_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "agents",
        sa.Column("discard_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agents", "discard_reason")
    op.drop_column("agents", "discarded_at")
    op.alter_column(
        "agents",
        "status",
        type_=sa.String(10),
        existing_type=sa.String(20),
        existing_nullable=False,
    )
