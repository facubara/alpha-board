"""Create memecoin tables: tokens, wallets, activity, twitter, signals.

Revision ID: 022
Revises: 021
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- Successful memecoin tokens (historical reference data) --
    op.create_table(
        "memecoin_tokens",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("mint_address", sa.String(64), unique=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("symbol", sa.String(20), nullable=True),
        sa.Column("image_uri", sa.Text, nullable=True),
        sa.Column("creator_wallet", sa.String(64), nullable=True),
        sa.Column("launchpad", sa.String(50), nullable=True),
        sa.Column("peak_mcap_usd", sa.Numeric(20, 2), nullable=True),
        sa.Column("current_mcap_usd", sa.Numeric(20, 2), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("first_seen_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("metadata", JSONB, nullable=False, server_default="{}"),
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
    op.create_index("idx_memecoin_tokens_symbol", "memecoin_tokens", ["symbol"])
    op.create_index(
        "idx_memecoin_tokens_mcap",
        "memecoin_tokens",
        [sa.text("peak_mcap_usd DESC")],
    )

    # -- Cross-referenced wallets --
    op.create_table(
        "watch_wallets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("address", sa.String(64), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("score", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("hit_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_tokens_traded", sa.Integer, nullable=False, server_default="0"),
        sa.Column("win_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column("avg_entry_rank", sa.Integer, nullable=True),
        sa.Column("tokens_summary", JSONB, nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("stats", JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "added_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("last_refreshed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("idx_watch_wallets_score", "watch_wallets", [sa.text("score DESC")])
    op.create_index("idx_watch_wallets_source", "watch_wallets", ["source"])

    # -- Live activity from watched wallets --
    op.create_table(
        "watch_wallet_activity",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "wallet_id",
            sa.Integer,
            sa.ForeignKey("watch_wallets.id"),
            nullable=False,
        ),
        sa.Column("token_mint", sa.String(64), nullable=False),
        sa.Column("token_symbol", sa.String(20), nullable=True),
        sa.Column("token_name", sa.String(200), nullable=True),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("amount_sol", sa.Numeric(20, 9), nullable=True),
        sa.Column("price_usd", sa.Numeric(30, 18), nullable=True),
        sa.Column("tx_signature", sa.String(128), unique=True, nullable=False),
        sa.Column("block_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "detected_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("metadata", JSONB, nullable=False, server_default="{}"),
    )
    op.create_index(
        "idx_ww_activity_wallet",
        "watch_wallet_activity",
        ["wallet_id", sa.text("block_time DESC")],
    )
    op.create_index(
        "idx_ww_activity_token",
        "watch_wallet_activity",
        ["token_mint", sa.text("block_time DESC")],
    )
    op.create_index(
        "idx_ww_activity_detected",
        "watch_wallet_activity",
        [sa.text("detected_at DESC")],
    )

    # -- Separate memecoin Twitter accounts --
    op.create_table(
        "memecoin_twitter_accounts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("handle", sa.String(30), unique=True, nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("is_vip", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "added_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # -- Memecoin tweets --
    op.create_table(
        "memecoin_tweets",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "account_id",
            sa.Integer,
            sa.ForeignKey("memecoin_twitter_accounts.id"),
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
        "idx_mc_tweets_account",
        "memecoin_tweets",
        ["account_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_mc_tweets_created",
        "memecoin_tweets",
        [sa.text("created_at DESC")],
    )

    # -- Token matches discovered from tweets --
    op.create_table(
        "memecoin_tweet_tokens",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "tweet_id",
            sa.BigInteger,
            sa.ForeignKey("memecoin_tweets.id"),
            nullable=False,
        ),
        sa.Column("token_mint", sa.String(64), nullable=True),
        sa.Column("token_symbol", sa.String(20), nullable=False),
        sa.Column("token_name", sa.String(200), nullable=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("dexscreener_url", sa.Text, nullable=True),
        sa.Column("market_cap_usd", sa.Numeric(20, 2), nullable=True),
        sa.Column("price_usd", sa.Numeric(30, 18), nullable=True),
        sa.Column("liquidity_usd", sa.Numeric(20, 2), nullable=True),
        sa.Column(
            "matched_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("metadata", JSONB, nullable=False, server_default="{}"),
    )
    op.create_index(
        "idx_mc_tweet_tokens_tweet", "memecoin_tweet_tokens", ["tweet_id"]
    )
    op.create_index(
        "idx_mc_tweet_tokens_symbol", "memecoin_tweet_tokens", ["token_symbol"]
    )

    # -- Memecoin tweet sentiment signals --
    op.create_table(
        "memecoin_tweet_signals",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "tweet_id",
            sa.BigInteger,
            sa.ForeignKey("memecoin_tweets.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column("sentiment_score", sa.Numeric(4, 3), nullable=False),
        sa.Column("setup_type", sa.String(30), nullable=True),
        sa.Column(
            "confidence", sa.Numeric(4, 3), nullable=False, server_default="0.500"
        ),
        sa.Column(
            "symbols_mentioned",
            ARRAY(sa.String),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("reasoning", sa.Text, nullable=False),
        sa.Column("model_used", sa.String(50), nullable=False),
        sa.Column("input_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "estimated_cost_usd",
            sa.Numeric(8, 4),
            nullable=False,
            server_default="0.0000",
        ),
        sa.Column(
            "analyzed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_mc_signals_analyzed",
        "memecoin_tweet_signals",
        [sa.text("analyzed_at DESC")],
    )

    # -- Seed llm_settings rows --
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
                "section_key": "memecoin_tweet_sentiment",
                "enabled": True,
                "display_name": "Memecoin Tweet Sentiment",
                "description": "Analyze memecoin tweets for sentiment and trading signals (Haiku 4.5)",
                "has_api_cost": True,
                "task_type": "tweet_sentiment",
            },
            {
                "section_key": "memecoin_vip_token_search",
                "enabled": True,
                "display_name": "VIP Token Search (LLM)",
                "description": "Extract token themes from VIP account tweets using LLM (Haiku 4.5)",
                "has_api_cost": True,
                "task_type": "tweet_sentiment",
            },
        ],
    )


def downgrade() -> None:
    op.execute("DELETE FROM llm_settings WHERE section_key IN ('memecoin_tweet_sentiment', 'memecoin_vip_token_search')")
    op.drop_table("memecoin_tweet_signals")
    op.drop_table("memecoin_tweet_tokens")
    op.drop_table("memecoin_tweets")
    op.drop_table("memecoin_twitter_accounts")
    op.drop_table("watch_wallet_activity")
    op.drop_table("watch_wallets")
    op.drop_table("memecoin_tokens")
