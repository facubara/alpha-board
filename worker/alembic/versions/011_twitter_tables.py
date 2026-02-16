"""Add twitter_accounts and tweets tables.

Revision ID: 011
Revises: 010
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "twitter_accounts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("handle", sa.String(30), unique=True, nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "added_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "tweets",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "twitter_account_id",
            sa.Integer,
            sa.ForeignKey("twitter_accounts.id"),
            nullable=False,
        ),
        sa.Column("tweet_id", sa.String(30), unique=True, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("metrics", JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "ingested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "idx_tweets_account_time",
        "tweets",
        ["twitter_account_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_tweets_created",
        "tweets",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_tweets_created")
    op.drop_index("idx_tweets_account_time")
    op.drop_table("tweets")
    op.drop_table("twitter_accounts")
