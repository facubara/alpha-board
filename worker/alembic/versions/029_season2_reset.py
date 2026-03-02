"""Season 2 reset — archive Season 1 portfolios, tag trades, close positions, reset equity.

1. Create agent_season_snapshots table
2. Archive Season 1 portfolio data into snapshots
3. Add season column to agent_trades, backfill existing rows to season=1
4. Force-close open positions as season_reset trades
5. Reset all active agent portfolios to $10k

Revision ID: 029
Revises: 028
"""

from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "028"


def upgrade() -> None:
    # Step 1: Create agent_season_snapshots table
    op.create_table(
        "agent_season_snapshots",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("season", sa.Integer, nullable=False),
        sa.Column("agent_id", sa.Integer, sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("agent_name", sa.String(50), nullable=False),
        sa.Column("cash_balance", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_equity", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_realized_pnl", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_fees_paid", sa.Numeric(14, 2), nullable=False),
        sa.Column("peak_equity", sa.Numeric(14, 2), nullable=False),
        sa.Column("trough_equity", sa.Numeric(14, 2), nullable=False),
        sa.Column("trade_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("win_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("win_rate", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("season", "agent_id", name="uq_season_snapshots_season_agent"),
    )

    # Step 2: Archive Season 1 data — snapshot portfolios with trade stats
    op.execute(
        sa.text("""
            INSERT INTO agent_season_snapshots
                (season, agent_id, agent_name, cash_balance, total_equity,
                 total_realized_pnl, total_fees_paid, peak_equity, trough_equity,
                 trade_count, win_count, win_rate)
            SELECT
                1,
                a.id,
                a.name,
                p.cash_balance,
                p.total_equity,
                p.total_realized_pnl,
                p.total_fees_paid,
                p.peak_equity,
                p.trough_equity,
                COALESCE(ts.trade_count, 0),
                COALESCE(ts.win_count, 0),
                CASE
                    WHEN COALESCE(ts.trade_count, 0) = 0 THEN 0.00
                    ELSE ROUND(COALESCE(ts.win_count, 0)::numeric / ts.trade_count * 100, 2)
                END
            FROM agents a
            JOIN agent_portfolios p ON p.agent_id = a.id
            LEFT JOIN (
                SELECT
                    agent_id,
                    COUNT(*) AS trade_count,
                    COUNT(*) FILTER (WHERE pnl > 0) AS win_count
                FROM agent_trades
                GROUP BY agent_id
            ) ts ON ts.agent_id = a.id
            WHERE a.status != 'discarded'
        """)
    )

    # Step 3: Add season column to agent_trades, backfill existing to season=1
    op.add_column(
        "agent_trades",
        sa.Column("season", sa.Integer, nullable=True),
    )
    op.execute(sa.text("UPDATE agent_trades SET season = 1"))
    op.alter_column("agent_trades", "season", nullable=False, server_default="2")

    # Step 4: Force-close open positions
    # Insert trade records for each open position, then delete positions
    op.execute(
        sa.text("""
            INSERT INTO agent_trades
                (agent_id, symbol_id, direction, entry_price, exit_price,
                 position_size, pnl, fees, exit_reason, opened_at, closed_at,
                 duration_minutes, season)
            SELECT
                agent_id,
                symbol_id,
                direction,
                entry_price,
                entry_price,
                position_size,
                unrealized_pnl,
                0.00,
                'season_reset',
                opened_at,
                NOW(),
                EXTRACT(EPOCH FROM (NOW() - opened_at))::int / 60,
                1
            FROM agent_positions
        """)
    )
    op.execute(sa.text("DELETE FROM agent_positions"))

    # Step 5: Reset all active agent portfolios to $10k
    op.execute(
        sa.text("""
            UPDATE agent_portfolios SET
                cash_balance = 10000.00,
                total_equity = 10000.00,
                total_realized_pnl = 0.00,
                total_fees_paid = 0.00,
                peak_equity = 10000.00,
                trough_equity = 10000.00,
                updated_at = NOW()
            WHERE agent_id IN (
                SELECT id FROM agents WHERE status = 'active'
            )
        """)
    )


def downgrade() -> None:
    # Note: This is a data migration — downgrade cannot fully restore
    # force-closed positions or original portfolio values.
    # It removes the structural changes only.
    op.drop_column("agent_trades", "season")
    op.drop_table("agent_season_snapshots")
