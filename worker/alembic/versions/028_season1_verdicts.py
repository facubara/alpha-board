"""Apply Season 1 verdicts — discard 5 structurally flawed agents.

Mean reversion on 4h/1d/1w timeframes has a fundamental mismatch:
the 3% SL / 4% TP (1.33:1 ratio) requires >57% WR to break even,
but longer timeframes trend rather than revert, yielding 0-32% WR.

Revision ID: 028
Revises: 027
"""

from alembic import op
import sqlalchemy as sa

revision = "028"
down_revision = "027"

# Agents to discard (Season 1 verdict: DISCARD — structural mismatch)
DISCARD_AGENTS = [
    "rb-meanreversion-4h",
    "hyb-mean_reversion-4h",
    "hyb-mean_reversion-1w",
    "rb-meanreversion-1d",
    "hyb-mean_reversion-1d",
]


def upgrade() -> None:
    for name in DISCARD_AGENTS:
        op.execute(
            sa.text(
                """
                UPDATE agents
                SET status = 'discarded',
                    discarded_at = NOW(),
                    discard_reason = 'Season 1 review: structural mismatch — mean reversion on longer timeframes trends instead of reverting'
                WHERE name = :name
                  AND status != 'discarded'
                """
            ).bindparams(name=name)
        )


def downgrade() -> None:
    for name in DISCARD_AGENTS:
        op.execute(
            sa.text(
                """
                UPDATE agents
                SET status = 'active',
                    discarded_at = NULL,
                    discard_reason = NULL
                WHERE name = :name
                  AND discard_reason LIKE 'Season 1 review%'
                """
            ).bindparams(name=name)
        )
