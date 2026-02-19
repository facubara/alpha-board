"""Add tweet_relevance_filter row to llm_settings.

Revision ID: 020
Revises: 019
"""

from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    llm_settings = sa.table(
        "llm_settings",
        sa.column("section_key", sa.String),
        sa.column("enabled", sa.Boolean),
        sa.column("display_name", sa.String),
        sa.column("description", sa.Text),
        sa.column("has_api_cost", sa.Boolean),
        sa.column("task_type", sa.String),
    )

    op.bulk_insert(
        llm_settings,
        [
            {
                "section_key": "tweet_relevance_filter",
                "enabled": True,
                "display_name": "Tweet Relevance Filter (LLM)",
                "description": "LLM fallback for ambiguous tweets that don't match keyword heuristics (~$0.0001/tweet)",
                "has_api_cost": True,
                "task_type": None,
            },
        ],
    )


def downgrade() -> None:
    op.execute("DELETE FROM llm_settings WHERE section_key = 'tweet_relevance_filter'")
