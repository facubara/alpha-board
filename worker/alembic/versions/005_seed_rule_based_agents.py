"""Seed 28 rule-based agents with portfolios and prompts.

Revision ID: 005
Revises: 004
Create Date: 2026-02-11
"""

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d", "1w"]
ARCHETYPES = [
    ("momentum", "RB Momentum Trader"),
    ("mean_reversion", "RB Mean Reversion"),
    ("breakout", "RB Breakout Hunter"),
    ("swing", "RB Swing Trader"),
]

CROSS_TF_AGENTS = [
    ("rb-cross-confluence", "RB Multi-TF Confluence", "momentum"),
    ("rb-cross-divergence", "RB Multi-TF Divergence", "mean_reversion"),
    ("rb-cross-cascade", "RB Timeframe Cascade", "breakout"),
    ("rb-cross-regime", "RB Regime Detector", "swing"),
]

# Rule descriptions stored as "prompts" for documentation purposes
RULE_DESCRIPTIONS = {
    "momentum": """Rule-based Momentum Trader.

Entry Long: bullish_score >= 0.70, confidence >= 60, RSI 50-70, MACD histogram > 0, ADX > 25 (+DI > -DI), price > EMA50 & EMA200, OBV slope > 0.
Entry Short: bullish_score <= 0.30, confidence >= 60, RSI 30-50, MACD histogram < 0, ADX > 25 (-DI > +DI), price < EMA50 & EMA200.
Exit Long: RSI > 75 or price < EMA20. Exit Short: RSI < 25 or price > EMA20.
Sizing: 15% (confidence >= 75), 8% (confidence 60-74). SL 4%, TP 6%.""",

    "mean_reversion": """Rule-based Mean Reversion Trader.

Entry Long: price > EMA200 (uptrend), RSI < 30 or BB %B < 0.05, stoch_k < 20 & k > d, bullish_score 0.20-0.45.
Entry Short: price < EMA200, RSI > 70 or BB %B > 0.95, stoch_k > 80 & k < d.
Exit: price returns to EMA20 (|pve20| < 0.3) or RSI normalizes (50-60 long, 40-50 short).
Sizing: 10%. SL 3%, TP 4%.""",

    "breakout": """Rule-based Breakout Hunter.

Entry Long: BB bandwidth < 5 (squeeze), %B > 1.0 (breakout), OBV slope > 2.0, ADX < 25, bullish_score 0.55-0.75.
Entry Short: same squeeze, %B < 0.0, OBV slope < -2.0, -DI > +DI.
Exit: %B returns to 0-1 range (false breakout). Max 2 concurrent positions.
Sizing: 8%. SL 5%, TP 10%.""",

    "swing": """Rule-based Swing Trader.

Entry Long: price > EMA50 & EMA200, EMA50 > EMA200, bullish_score >= 0.55, confidence >= 65, RSI 40-55, stoch_k < 50 & k > d, ADX >= 20.
Entry Short: price < EMA50 & EMA200, EMA50 < EMA200, bullish_score <= 0.45, RSI 45-60, stoch_k > 50 & k < d.
Exit Long: RSI >= 70 or price < EMA200. Exit Short: RSI <= 30 or price > EMA200.
Sizing: 20% (confidence >= 70), 12% otherwise. Max 3 concurrent. SL 4%, TP 8%.""",
}

CROSS_TF_RULE_DESCRIPTIONS = {
    "rb-cross-confluence": """Rule-based Multi-TF Confluence.

Entry Long: symbol in bullish confluence (3+ TFs with score > 0.6).
Entry Short: symbol in bearish confluence (3+ TFs with score < 0.4).
Exit: symbol drops from confluence list.
Sizing: 18%. Max 3 concurrent. SL 6%, TP 12%.""",

    "rb-cross-divergence": """Rule-based Multi-TF Divergence.

Entry Long: 1D/1W avg score >= 0.60 AND 15m/1h avg score <= 0.35.
Entry Short: 1D/1W avg score <= 0.40 AND 15m/1h avg score >= 0.65.
Exit: divergence resolves or long-term turns against.
Sizing: 10%. Max 4 concurrent. SL 5%, TP 8%.""",

    "rb-cross-cascade": """Rule-based Timeframe Cascade.

Entry Long: 1W >= 0.60, 1D >= 0.55, shorter TF <= 0.50.
Entry Short: 1W <= 0.40, 1D <= 0.45, shorter TF >= 0.50.
Exit: cascade completes (1H aligns) or 1W reverts.
Sizing: 12%. Max 3 concurrent. SL 6%, TP 10%.""",

    "rb-cross-regime": """Rule-based Regime Detector.

Trending Bull: 4+ TFs with score > 0.60. Trending Bear: 4+ TFs with score < 0.40.
Entry Long: strongest trending bull symbol. Entry Short: strongest trending bear.
Exit: regime shifts to ranging (4+ TFs with 0.40-0.60) or hard 5% stop.
Do NOT trade ranging markets. Sizing: 15%. Max 3 concurrent. SL 5%, TP 10%.""",
}


def upgrade() -> None:
    agents_table = sa.table(
        "agents",
        sa.column("name", sa.String),
        sa.column("display_name", sa.String),
        sa.column("strategy_archetype", sa.String),
        sa.column("timeframe", sa.String),
        sa.column("scan_model", sa.String),
        sa.column("trade_model", sa.String),
        sa.column("evolution_model", sa.String),
        sa.column("engine", sa.String),
    )

    # Seed 24 timeframe-specific rule-based agents
    tf_agents = []
    for tf in TIMEFRAMES:
        for archetype, display in ARCHETYPES:
            name = f"rb-{archetype.replace('_', '')}-{tf}"
            display_name = f"{display} ({tf.upper()})"
            tf_agents.append(
                {
                    "name": name,
                    "display_name": display_name,
                    "strategy_archetype": archetype,
                    "timeframe": tf,
                    "scan_model": "none",
                    "trade_model": "none",
                    "evolution_model": "none",
                    "engine": "rule",
                }
            )

    op.bulk_insert(agents_table, tf_agents)

    # Seed 4 cross-TF rule-based agents
    cross_agents = [
        {
            "name": name,
            "display_name": display,
            "strategy_archetype": archetype,
            "timeframe": "cross",
            "scan_model": "none",
            "trade_model": "none",
            "evolution_model": "none",
            "engine": "rule",
        }
        for name, display, archetype in CROSS_TF_AGENTS
    ]
    op.bulk_insert(agents_table, cross_agents)

    # Initialize portfolios for all new rule-based agents
    op.execute(
        """
        INSERT INTO agent_portfolios (agent_id, cash_balance, total_equity)
        SELECT id, initial_balance, initial_balance FROM agents
        WHERE engine = 'rule' AND id NOT IN (SELECT agent_id FROM agent_portfolios);
        """
    )

    # Insert rule descriptions as "prompts" for documentation
    for tf in TIMEFRAMES:
        for archetype, _ in ARCHETYPES:
            agent_name = f"rb-{archetype.replace('_', '')}-{tf}"
            prompt = RULE_DESCRIPTIONS[archetype]
            op.execute(
                sa.text(
                    """
                INSERT INTO agent_prompts (agent_id, version, system_prompt, source, is_active)
                SELECT id, 1, :prompt, 'initial', true
                FROM agents WHERE name = :name
                """
                ).bindparams(prompt=prompt, name=agent_name)
            )

    for name, _, _ in CROSS_TF_AGENTS:
        prompt = CROSS_TF_RULE_DESCRIPTIONS[name]
        op.execute(
            sa.text(
                """
            INSERT INTO agent_prompts (agent_id, version, system_prompt, source, is_active)
            SELECT id, 1, :prompt, 'initial', true
            FROM agents WHERE name = :name
            """
            ).bindparams(prompt=prompt, name=name)
        )


def downgrade() -> None:
    op.execute("DELETE FROM agent_prompts WHERE agent_id IN (SELECT id FROM agents WHERE engine = 'rule')")
    op.execute("DELETE FROM agent_portfolios WHERE agent_id IN (SELECT id FROM agents WHERE engine = 'rule')")
    op.execute("DELETE FROM agents WHERE engine = 'rule'")
