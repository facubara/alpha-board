"""Add token_tracker and token_tracker_snapshots tables.

Enables real-time market data tracking for memecoin tokens with
holder counts, price, volume, and historical sparklines.

Revision ID: 026
Revises: 025
"""

from alembic import op
import sqlalchemy as sa

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "token_tracker",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("mint_address", sa.String(64), unique=True, nullable=False),
        sa.Column("symbol", sa.String(20)),
        sa.Column("name", sa.String(200)),
        sa.Column("source", sa.String(10), nullable=False, server_default="manual"),
        sa.Column("refresh_interval_minutes", sa.Integer, nullable=False, server_default="15"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("latest_holders", sa.Integer),
        sa.Column("latest_price_usd", sa.Numeric(30, 18)),
        sa.Column("latest_volume_24h_usd", sa.Numeric(20, 2)),
        sa.Column("latest_mcap_usd", sa.Numeric(20, 2)),
        sa.Column("latest_liquidity_usd", sa.Numeric(20, 2)),
        sa.Column("last_refreshed_at", sa.TIMESTAMP(timezone=True)),
        sa.Column(
            "added_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("idx_token_tracker_mint", "token_tracker", ["mint_address"])
    op.create_index("idx_token_tracker_source", "token_tracker", ["source"])
    op.create_index(
        "idx_token_tracker_active_refresh",
        "token_tracker",
        ["is_active", "last_refreshed_at"],
    )

    op.create_table(
        "token_tracker_snapshots",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "token_id",
            sa.Integer,
            sa.ForeignKey("token_tracker.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("holders", sa.Integer),
        sa.Column("price_usd", sa.Numeric(30, 18)),
        sa.Column("volume_24h_usd", sa.Numeric(20, 2)),
        sa.Column("mcap_usd", sa.Numeric(20, 2)),
        sa.Column(
            "snapshot_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_token_snapshots_token_time",
        "token_tracker_snapshots",
        ["token_id", sa.text("snapshot_at DESC")],
    )


def downgrade() -> None:
    op.drop_table("token_tracker_snapshots")
    op.drop_table("token_tracker")
