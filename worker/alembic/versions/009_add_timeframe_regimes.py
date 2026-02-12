"""Add timeframe_regimes table for persisted regime classification.

Revision ID: 009
Revises: 008
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "timeframe_regimes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("timeframe", sa.String(10), nullable=False, unique=True),
        sa.Column("regime", sa.String(20), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 2), nullable=False),
        sa.Column("avg_bullish_score", sa.Numeric(5, 3), nullable=True),
        sa.Column("avg_adx", sa.Numeric(8, 2), nullable=True),
        sa.Column("avg_bandwidth", sa.Numeric(8, 2), nullable=True),
        sa.Column("symbols_analyzed", sa.Integer, nullable=True),
        sa.Column(
            "computed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("timeframe_regimes")
