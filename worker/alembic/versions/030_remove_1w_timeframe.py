"""Remove 1w timeframe — delete all 1w agents, trades, positions, and snapshots.

This is a destructive migration. The 1w (weekly) timeframe is being removed because
it takes too long to produce meaningful results.

Revision ID: 030
Revises: 029
"""

from alembic import op


revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Delete all related data for 1w agents (order matters for FK constraints)
    # Positions are ephemeral (deleted on close, no status column), so just delete them.
    for table in [
        "agent_positions",
        "agent_trades",
        "agent_decisions",
        "agent_memory",
        "agent_token_usage",
        "agent_prompts",
        "agent_portfolios",
    ]:
        conn.execute(
            __import__("sqlalchemy").text(f"""
                DELETE FROM {table}
                WHERE agent_id IN (SELECT id FROM agents WHERE timeframe = '1w')
            """)
        )

    # 3. Delete the 1w agents themselves
    conn.execute(
        __import__("sqlalchemy").text("""
            DELETE FROM agents WHERE timeframe = '1w'
        """)
    )

    # 4. Delete all 1w snapshots
    conn.execute(
        __import__("sqlalchemy").text("""
            DELETE FROM snapshots WHERE timeframe = '1w'
        """)
    )


def downgrade() -> None:
    # Destructive migration — data cannot be restored
    pass
