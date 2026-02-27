"""Add processing_runs and agent_analysis_history tables.

Enables manual LLM processing via Claude Code CLI scripts,
with progress tracking and agent performance review history.

Revision ID: 027
Revises: 026
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "processing_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("task_type", sa.String(30), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="running",
        ),
        sa.Column("total_items", sa.Integer, nullable=False, server_default="0"),
        sa.Column("processed_items", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("paused_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("metadata", JSONB, nullable=False, server_default="{}"),
    )
    op.create_index(
        "idx_processing_runs_task",
        "processing_runs",
        ["task_type", sa.text("started_at DESC")],
    )

    op.create_table(
        "agent_analysis_history",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "agent_id",
            sa.Integer,
            sa.ForeignKey("agents.id"),
            nullable=False,
        ),
        sa.Column(
            "analysis_type",
            sa.String(30),
            nullable=False,
            server_default="performance_review",
        ),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("full_analysis", sa.Text, nullable=False),
        sa.Column("recommendations", JSONB, nullable=False, server_default="'[]'"),
        sa.Column("metrics_snapshot", JSONB, nullable=False, server_default="'{}'"),
        sa.Column(
            "processing_run_id",
            sa.Integer,
            sa.ForeignKey("processing_runs.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_agent_analysis_agent",
        "agent_analysis_history",
        ["agent_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_agent_analysis_agent")
    op.drop_table("agent_analysis_history")
    op.drop_index("idx_processing_runs_task")
    op.drop_table("processing_runs")
