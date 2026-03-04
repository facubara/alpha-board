"""Variable seasons — per-timeframe season tracking.

1. Create timeframe_seasons table with per-TF season state
2. Seed all 5 timeframes at season 2 (matching current global season)
3. Add timeframe column to agent_season_snapshots
4. Backfill timeframe from agents table
5. Update unique constraint to include timeframe

Revision ID: 031
Revises: 030
"""

from alembic import op
import sqlalchemy as sa

revision = "031"
down_revision = "030"


def upgrade() -> None:
    # Step 1: Create timeframe_seasons table
    op.create_table(
        "timeframe_seasons",
        sa.Column("timeframe", sa.String(4), primary_key=True),
        sa.Column("current_season", sa.Integer, nullable=False, server_default="1"),
        sa.Column("season_start", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("season_end", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Step 2: Seed all 5 timeframes at season 2 with appropriate durations
    # 15m = 1 week, 30m = 2 weeks, 1h = 1 month, 4h = 3 months, 1d = 6 months
    op.execute(
        sa.text("""
            INSERT INTO timeframe_seasons (timeframe, current_season, season_start, season_end)
            VALUES
                ('15m', 2, NOW(), NOW() + INTERVAL '7 days'),
                ('30m', 2, NOW(), NOW() + INTERVAL '14 days'),
                ('1h',  2, NOW(), NOW() + INTERVAL '1 month'),
                ('4h',  2, NOW(), NOW() + INTERVAL '3 months'),
                ('1d',  2, NOW(), NOW() + INTERVAL '6 months')
        """)
    )

    # Step 3: Add timeframe column to agent_season_snapshots (nullable first)
    op.add_column(
        "agent_season_snapshots",
        sa.Column("timeframe", sa.String(4), nullable=True),
    )

    # Step 4: Backfill timeframe from agents table
    op.execute(
        sa.text("""
            UPDATE agent_season_snapshots s
            SET timeframe = a.timeframe
            FROM agents a
            WHERE s.agent_id = a.id
        """)
    )

    # Handle any orphan snapshots (shouldn't exist, but be safe)
    op.execute(
        sa.text("""
            UPDATE agent_season_snapshots
            SET timeframe = '1h'
            WHERE timeframe IS NULL
        """)
    )

    # Make timeframe NOT NULL
    op.alter_column("agent_season_snapshots", "timeframe", nullable=False)

    # Step 5: Drop old unique constraint, add new one including timeframe
    op.drop_constraint(
        "uq_season_snapshots_season_agent",
        "agent_season_snapshots",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_season_snapshots_tf_season_agent",
        "agent_season_snapshots",
        ["timeframe", "season", "agent_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_season_snapshots_tf_season_agent",
        "agent_season_snapshots",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_season_snapshots_season_agent",
        "agent_season_snapshots",
        ["season", "agent_id"],
    )
    op.drop_column("agent_season_snapshots", "timeframe")
    op.drop_table("timeframe_seasons")
