"""Create llm_settings table for per-section cost control.

Seed 6 rows: llm_trade_decisions, rule_trade_decisions,
prompt_evolution, post_mortem, trade_memory, tweet_sentiment.

Revision ID: 019
Revises: 018
"""

from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_settings",
        sa.Column("section_key", sa.String(30), primary_key=True),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("has_api_cost", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("task_type", sa.String(15), nullable=True),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Seed rows
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
                "section_key": "llm_trade_decisions",
                "enabled": True,
                "display_name": "LLM Trade Decisions",
                "description": "LLM agents analyze rankings and decide to open/close/hold positions (Sonnet 4)",
                "has_api_cost": True,
                "task_type": "trade",
            },
            {
                "section_key": "rule_trade_decisions",
                "enabled": True,
                "display_name": "Rule Trade Decisions",
                "description": "Rule-based agents execute deterministic strategies (no API cost)",
                "has_api_cost": False,
                "task_type": None,
            },
            {
                "section_key": "prompt_evolution",
                "enabled": True,
                "display_name": "Prompt Evolution",
                "description": "Rewrite agent system prompts based on performance (Opus 4.5)",
                "has_api_cost": True,
                "task_type": "evolution",
            },
            {
                "section_key": "post_mortem",
                "enabled": True,
                "display_name": "Post-Mortem Analysis",
                "description": "Extract fleet lessons from discarded agents (Haiku 3.5)",
                "has_api_cost": True,
                "task_type": "postmortem",
            },
            {
                "section_key": "trade_memory",
                "enabled": True,
                "display_name": "Trade Memory",
                "description": "Generate 1-3 sentence reflections after each trade (Haiku 3.5)",
                "has_api_cost": True,
                "task_type": "scan",
            },
            {
                "section_key": "tweet_sentiment",
                "enabled": True,
                "display_name": "Tweet Sentiment Analysis",
                "description": "Batch-analyze tweets for sentiment and trading signals (Haiku 4.5)",
                "has_api_cost": True,
                "task_type": "tweet_sentiment",
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("llm_settings")
