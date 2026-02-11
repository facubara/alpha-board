"""Widen symbol and base_asset columns to handle longer Binance token names.

BROCCOLI714USDT has base_asset='BROCCOLI714' (11 chars) which exceeds VARCHAR(10).

Revision ID: 006
Revises: 005
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("symbols", "symbol", type_=sa.String(30), existing_type=sa.String(20))
    op.alter_column("symbols", "base_asset", type_=sa.String(20), existing_type=sa.String(10))


def downgrade() -> None:
    op.alter_column("symbols", "symbol", type_=sa.String(20), existing_type=sa.String(30))
    op.alter_column("symbols", "base_asset", type_=sa.String(10), existing_type=sa.String(20))
