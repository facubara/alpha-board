"""Add tweet_signals table for LLM sentiment analysis.

Revision ID: 012
Revises: 011
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tweet_signals",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "tweet_id",
            sa.BigInteger,
            sa.ForeignKey("tweets.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column("sentiment_score", sa.Numeric(4, 3), nullable=False),
        sa.Column("setup_type", sa.String(30), nullable=True),
        sa.Column(
            "confidence", sa.Numeric(4, 3), nullable=False, server_default="0.500"
        ),
        sa.Column(
            "symbols_mentioned",
            ARRAY(sa.String),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("reasoning", sa.Text, nullable=False),
        sa.Column("model_used", sa.String(50), nullable=False),
        sa.Column("input_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "estimated_cost_usd",
            sa.Numeric(8, 4),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "analyzed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "idx_tweet_signals_sentiment", "tweet_signals", ["sentiment_score"]
    )
    op.create_index(
        "idx_tweet_signals_setup",
        "tweet_signals",
        ["setup_type"],
        postgresql_where=sa.text("setup_type IS NOT NULL"),
    )
    op.create_index(
        "idx_tweet_signals_analyzed",
        "tweet_signals",
        [sa.text("analyzed_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_tweet_signals_analyzed")
    op.drop_index("idx_tweet_signals_setup")
    op.drop_index("idx_tweet_signals_sentiment")
    op.drop_table("tweet_signals")
