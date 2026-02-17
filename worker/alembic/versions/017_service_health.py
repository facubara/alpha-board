"""Create service health monitoring tables.

Tables:
- service_health_checks — raw check results (retained 7 days)
- service_daily_status — aggregated daily rollup (retained 180 days)
- service_incidents — auto-detected incidents

Revision ID: 017
Revises: 016
"""

from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Raw health check results
    op.create_table(
        "service_health_checks",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("service", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "checked_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_health_checks_service_time",
        "service_health_checks",
        ["service", sa.text("checked_at DESC")],
    )

    # Daily status rollup
    op.create_table(
        "service_daily_status",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("service", sa.String(50), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("total_checks", sa.Integer, nullable=False),
        sa.Column("successful_checks", sa.Integer, nullable=False),
        sa.Column("uptime_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("avg_latency_ms", sa.Integer, nullable=True),
        sa.Column("max_latency_ms", sa.Integer, nullable=True),
        sa.Column("incidents", sa.Integer, nullable=False, server_default="0"),
        sa.Column("worst_status", sa.String(20), nullable=False),
        sa.UniqueConstraint("service", "date", name="uq_service_daily_status_service_date"),
    )

    # Incident tracking
    op.create_table(
        "service_incidents",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("service", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Integer, nullable=True),
        sa.Column("error_summary", sa.Text, nullable=True),
    )
    op.create_index(
        "idx_incidents_service_time",
        "service_incidents",
        ["service", sa.text("started_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_incidents_service_time")
    op.drop_table("service_incidents")
    op.drop_table("service_daily_status")
    op.drop_index("idx_health_checks_service_time")
    op.drop_table("service_health_checks")
