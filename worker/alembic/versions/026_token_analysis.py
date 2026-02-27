"""Add token analysis, analyzed wallets, wallet token entries, and cross-reference checks tables.

Revision ID: 026b
Revises: 026
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "026b"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- Token analysis jobs --
    op.create_table(
        "token_analyses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("mint_address", sa.String(64), nullable=False),
        sa.Column("token_symbol", sa.String(20), nullable=True),
        sa.Column("token_name", sa.String(200), nullable=True),
        sa.Column("market_cap_usd", sa.Numeric(20, 2), nullable=True),
        sa.Column("requested_buyers", sa.Integer, nullable=False),
        sa.Column("found_buyers", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("progress", JSONB, nullable=False, server_default="{}"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "requested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("idx_token_analyses_status", "token_analyses", ["status"])
    op.create_index(
        "idx_token_analyses_mint", "token_analyses", ["mint_address"]
    )

    # -- Analyzed wallet profiles --
    op.create_table(
        "analyzed_wallets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("address", sa.String(64), unique=True, nullable=False),
        sa.Column("sol_balance", sa.Numeric(20, 9), nullable=True),
        sa.Column("usdc_balance", sa.Numeric(20, 2), nullable=True),
        sa.Column("first_tx_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("total_tx_count", sa.Integer, nullable=True),
        sa.Column("estimated_pnl_sol", sa.Numeric(20, 9), nullable=True),
        sa.Column("win_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column("tokens_traded", sa.Integer, nullable=True),
        sa.Column("current_holdings", JSONB, nullable=False, server_default="[]"),
        sa.Column("tags", JSONB, nullable=False, server_default="[]"),
        sa.Column("last_enriched_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("idx_analyzed_wallets_address", "analyzed_wallets", ["address"])

    # -- Wallet-token early entries --
    op.create_table(
        "wallet_token_entries",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "wallet_id",
            sa.Integer,
            sa.ForeignKey("analyzed_wallets.id"),
            nullable=False,
        ),
        sa.Column(
            "analysis_id",
            sa.Integer,
            sa.ForeignKey("token_analyses.id"),
            nullable=False,
        ),
        sa.Column("mint_address", sa.String(64), nullable=False),
        sa.Column("token_symbol", sa.String(20), nullable=True),
        sa.Column("entry_rank", sa.Integer, nullable=False),
        sa.Column("entry_tx_signature", sa.String(128), nullable=True),
        sa.Column("entry_block_time", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("amount_sol", sa.Numeric(20, 9), nullable=True),
        sa.Column("token_mcap_at_entry", sa.Numeric(20, 2), nullable=True),
        sa.Column("token_peak_mcap", sa.Numeric(20, 2), nullable=True),
        sa.UniqueConstraint("wallet_id", "mint_address", name="uq_wallet_token_entry"),
    )
    op.create_index(
        "idx_wte_wallet", "wallet_token_entries", ["wallet_id"]
    )
    op.create_index(
        "idx_wte_mint", "wallet_token_entries", ["mint_address"]
    )
    op.create_index(
        "idx_wte_analysis", "wallet_token_entries", ["analysis_id"]
    )

    # -- Cross-reference check log --
    op.create_table(
        "cross_reference_checks",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("mint_address", sa.String(64), nullable=False),
        sa.Column("token_symbol", sa.String(20), nullable=True),
        sa.Column("token_name", sa.String(200), nullable=True),
        sa.Column("buyers_scanned", sa.Integer, nullable=False, server_default="0"),
        sa.Column("matches_found", sa.Integer, nullable=False, server_default="0"),
        sa.Column("top_match_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("results", JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "checked_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_xref_checks_time",
        "cross_reference_checks",
        [sa.text("checked_at DESC")],
    )

    # -- Add memecoin notification columns to notification_preferences --
    op.add_column(
        "notification_preferences",
        sa.Column(
            "notify_memecoin_buys",
            sa.Boolean,
            nullable=False,
            server_default="true",
        ),
    )
    op.add_column(
        "notification_preferences",
        sa.Column(
            "notify_memecoin_sells",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("notification_preferences", "notify_memecoin_sells")
    op.drop_column("notification_preferences", "notify_memecoin_buys")
    op.drop_table("cross_reference_checks")
    op.drop_table("wallet_token_entries")
    op.drop_table("analyzed_wallets")
    op.drop_table("token_analyses")
