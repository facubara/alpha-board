"""Initial schema: symbols, indicators, computation_runs, snapshots.

Revision ID: 001
Revises:
Create Date: 2026-02-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==========================================================================
    # symbols table
    # ==========================================================================
    op.create_table(
        "symbols",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(20), nullable=False, unique=True),
        sa.Column("base_asset", sa.String(10), nullable=False),
        sa.Column("quote_asset", sa.String(10), nullable=False, server_default="USDT"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_seen_at", sa.TIMESTAMP(timezone=True)),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )

    # ==========================================================================
    # indicators table
    # ==========================================================================
    op.create_table(
        "indicators",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(30), nullable=False, unique=True),
        sa.Column("display_name", sa.String(50), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("weight", sa.Numeric(3, 2), nullable=False, server_default="0.10"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
    )

    # ==========================================================================
    # computation_runs table
    # ==========================================================================
    op.create_table(
        "computation_runs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.func.gen_random_uuid(),
        ),
        sa.Column("timeframe", sa.String(4), nullable=False),
        sa.Column(
            "started_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("finished_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("symbol_count", sa.SmallInteger()),
        sa.Column("status", sa.String(10), nullable=False, server_default="running"),
        sa.Column("error_message", sa.Text()),
    )

    # ==========================================================================
    # snapshots table (partitioned by month on computed_at)
    # ==========================================================================
    op.execute(
        """
        CREATE TABLE snapshots (
            id BIGSERIAL,
            symbol_id INT NOT NULL REFERENCES symbols(id),
            timeframe VARCHAR(4) NOT NULL,
            bullish_score NUMERIC(4,3) NOT NULL,
            confidence SMALLINT NOT NULL,
            rank SMALLINT NOT NULL,
            highlights JSONB NOT NULL DEFAULT '[]',
            indicator_signals JSONB NOT NULL DEFAULT '{}',
            computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            run_id UUID NOT NULL REFERENCES computation_runs(id),
            PRIMARY KEY (id, computed_at)
        ) PARTITION BY RANGE (computed_at);
        """
    )

    # Create partitions for 2026-02 through 2026-04
    op.execute(
        """
        CREATE TABLE snapshots_2026_02 PARTITION OF snapshots
            FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
        """
    )
    op.execute(
        """
        CREATE TABLE snapshots_2026_03 PARTITION OF snapshots
            FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
        """
    )
    op.execute(
        """
        CREATE TABLE snapshots_2026_04 PARTITION OF snapshots
            FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
        """
    )

    # Create indexes on snapshots
    op.create_index("idx_snapshots_tf_time", "snapshots", ["timeframe", sa.text("computed_at DESC")])
    op.create_index(
        "idx_snapshots_symbol_tf_time",
        "snapshots",
        ["symbol_id", "timeframe", sa.text("computed_at DESC")],
    )
    op.create_index("idx_snapshots_run", "snapshots", ["run_id"])


def downgrade() -> None:
    op.drop_index("idx_snapshots_run", table_name="snapshots")
    op.drop_index("idx_snapshots_symbol_tf_time", table_name="snapshots")
    op.drop_index("idx_snapshots_tf_time", table_name="snapshots")

    # Drop partitions first, then parent table
    op.execute("DROP TABLE IF EXISTS snapshots_2026_04")
    op.execute("DROP TABLE IF EXISTS snapshots_2026_03")
    op.execute("DROP TABLE IF EXISTS snapshots_2026_02")
    op.execute("DROP TABLE IF EXISTS snapshots")

    op.drop_table("computation_runs")
    op.drop_table("indicators")
    op.drop_table("symbols")
