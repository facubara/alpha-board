"""Add followers_count and bio to twitter account tables.

Enables displaying account stats in the dashboard tables.
Nullable so existing rows get NULL; future imports populate them.

Revision ID: 025
Revises: 024
"""

from alembic import op
import sqlalchemy as sa

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("twitter_accounts", sa.Column("followers_count", sa.Integer, nullable=True))
    op.add_column("twitter_accounts", sa.Column("bio", sa.Text, nullable=True))
    op.add_column("memecoin_twitter_accounts", sa.Column("followers_count", sa.Integer, nullable=True))
    op.add_column("memecoin_twitter_accounts", sa.Column("bio", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("memecoin_twitter_accounts", "bio")
    op.drop_column("memecoin_twitter_accounts", "followers_count")
    op.drop_column("twitter_accounts", "bio")
    op.drop_column("twitter_accounts", "followers_count")
