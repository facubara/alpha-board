"""Add source column to agents and seed 48 tweet-only agents.

Revision ID: 013
Revises: 012
Create Date: 2026-02-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d", "1w"]

TWEET_ARCHETYPES = [
    ("tweet_momentum", "TW Momentum Rider"),
    ("tweet_contrarian", "TW Contrarian Fader"),
    ("tweet_narrative", "TW Narrative Follower"),
    ("tweet_insider", "TW Insider Tracker"),
]

# System prompts for LLM tweet agents
TWEET_LLM_PROMPTS = {
    "tweet_momentum": """You are a crypto trading agent that rides social media momentum.

You analyze tweet signals from tracked crypto accounts to identify assets gaining positive attention.
When multiple credible accounts are bullish on a symbol with rising engagement, you open long positions.
When sentiment is strongly negative across multiple accounts, you open short positions.
You cut positions when sentiment reverses (flips sign) or confidence drops below 0.3.

Key rules:
- Require avg_sentiment >= 0.4 with >= 3 bullish signals for longs
- Require avg_sentiment <= -0.4 with >= 3 bearish signals for shorts
- Pay attention to engagement metrics (likes, retweets) as confirmation
- Exit when sentiment flips to opposite sign
- Position size: 12% of portfolio. Stop loss: 4%. Take profit: 8%
- Maximum 5 concurrent positions

You receive tweet signal data with sentiment scores, setup types, and account categories.
Make decisions based purely on social sentiment — no technical indicators.""",

    "tweet_contrarian": """You are a crypto trading agent that fades extreme crowd sentiment.

You analyze tweet signals to identify overreaction in the market. When the crowd is in extreme panic
(avg_sentiment <= -0.6 with many bearish signals), you buy. When the crowd is in extreme greed
(avg_sentiment >= 0.6 with many bullish signals), you sell short.

Key rules:
- Buy (long) only during extreme fear: avg_sentiment <= -0.6, bearish_count >= 4
- Sell (short) only during extreme greed: avg_sentiment >= 0.6, bullish_count >= 4
- Exit when sentiment normalizes to neutral range (-0.2 to +0.2)
- Be patient — only trade at extremes, not mild sentiment
- Position size: 10% of portfolio. Stop loss: 5%. Take profit: 6%
- Maximum 5 concurrent positions

You receive tweet signal data with sentiment scores and account categories.
Think contrarian — the crowd is usually wrong at extremes.""",

    "tweet_narrative": """You are a crypto trading agent that follows macro narrative from credible sources.

You analyze tweet signals specifically from analyst, founder, and insider accounts. You ignore noise
from degen accounts. When multiple credible sources agree on a directional thesis (long_entry or
short_entry setup types), you follow that narrative.

Key rules:
- Only consider signals from analyst, founder, insider, and protocol accounts
- Filter out "degen" category completely for higher signal quality
- Require >= 3 credible signals with matching setup_type (long_entry/short_entry) for entry
- Exit when narrative shifts — signals change to "warning" or "take_profit" setup types
- Position size: 15% of portfolio. Stop loss: 4%. Take profit: 10%
- Maximum 5 concurrent positions

You receive tweet signal data with categories and setup types.
Focus on quality over quantity — a few credible voices matter more than many anonymous ones.""",

    "tweet_insider": """You are a crypto trading agent that heavily weights founder and insider signals.

You analyze tweet signals and apply 2x weight to signals from founder/insider category accounts.
These insiders often have information advantages and their sentiment shifts can precede price moves.

Key rules:
- Apply 2x weight to founder/insider signals when computing weighted sentiment
- Require weighted_sentiment >= 0.3 AND at least 1 insider long_entry signal for longs
- Require weighted_sentiment <= -0.3 AND at least 1 insider short_entry signal for shorts
- Exit when insider-only sentiment flips sign
- A single strong insider signal can outweigh multiple weaker signals
- Position size: 10% of portfolio. Stop loss: 3%. Take profit: 6%
- Maximum 5 concurrent positions

You receive tweet signal data with account categories and sentiment.
Trust the insiders — they know things the crowd doesn't.""",
}

# Rule descriptions for documentation
TWEET_RULE_DESCRIPTIONS = {
    "tweet_momentum": """Rule-based Tweet Momentum Rider.

Entry Long: avg_sentiment >= 0.4, bullish_count >= 3, top symbol has >= 2 bullish mentions.
Entry Short: avg_sentiment <= -0.4, bearish_count >= 3.
Exit: sentiment reverses (flips sign) or confidence drops below 0.3.
Sizing: 12%. SL 4%, TP 8%.""",

    "tweet_contrarian": """Rule-based Tweet Contrarian Fader.

Entry Long: avg_sentiment <= -0.6 (extreme fear), >= 4 bearish signals (crowd panic = buy).
Entry Short: avg_sentiment >= 0.6 (extreme greed), >= 4 bullish signals.
Exit: sentiment returns to neutral range (-0.2 to +0.2).
Sizing: 10%. SL 5%, TP 6%.""",

    "tweet_narrative": """Rule-based Tweet Narrative Follower.

Entry Long: >= 3 signals with setup_type "long_entry", from analyst/founder accounts.
Entry Short: >= 3 signals with setup_type "short_entry", from analyst/founder accounts.
Filters out "degen" category for higher signal quality.
Exit: narrative shifts (setup_type changes to "warning" or "take_profit").
Sizing: 15%. SL 4%, TP 10%.""",

    "tweet_insider": """Rule-based Tweet Insider Tracker.

Applies 2x weight to founder/insider category signals.
Entry Long: weighted_sentiment >= 0.3, >= 1 insider long_entry signal.
Entry Short: weighted_sentiment <= -0.3, >= 1 insider short_entry signal.
Exit: insider sentiment flips.
Sizing: 10%. SL 3%, TP 6%.""",
}


def upgrade() -> None:
    # 1. Add source column to agents table
    op.add_column(
        "agents",
        sa.Column("source", sa.String(20), nullable=False, server_default="technical"),
    )

    # 2. Seed 48 tweet agents (4 archetypes x 6 TFs x 2 engines)
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
        sa.column("source", sa.String),
    )

    tweet_agents = []
    for tf in TIMEFRAMES:
        for archetype, display in TWEET_ARCHETYPES:
            # Rule-based agent
            rule_name = f"tw-{archetype.replace('tweet_', '')}-{tf}"
            rule_display = f"{display} ({tf.upper()})"
            tweet_agents.append({
                "name": rule_name,
                "display_name": rule_display,
                "strategy_archetype": archetype,
                "timeframe": tf,
                "scan_model": "none",
                "trade_model": "none",
                "evolution_model": "none",
                "engine": "rule",
                "source": "tweet",
            })

            # LLM agent
            llm_name = f"tw-llm-{archetype.replace('tweet_', '')}-{tf}"
            llm_display = f"TW-LLM {display.replace('TW ', '')} ({tf.upper()})"
            tweet_agents.append({
                "name": llm_name,
                "display_name": llm_display,
                "strategy_archetype": archetype,
                "timeframe": tf,
                "scan_model": "claude-haiku-4-5-20251001",
                "trade_model": "claude-haiku-4-5-20251001",
                "evolution_model": "claude-haiku-4-5-20251001",
                "engine": "llm",
                "source": "tweet",
            })

    op.bulk_insert(agents_table, tweet_agents)

    # 3. Initialize portfolios for all new tweet agents
    op.execute(
        """
        INSERT INTO agent_portfolios (agent_id, cash_balance, total_equity)
        SELECT id, initial_balance, initial_balance FROM agents
        WHERE source = 'tweet' AND id NOT IN (SELECT agent_id FROM agent_portfolios);
        """
    )

    # 4. Insert prompts for rule-based tweet agents
    for tf in TIMEFRAMES:
        for archetype, _ in TWEET_ARCHETYPES:
            rule_name = f"tw-{archetype.replace('tweet_', '')}-{tf}"
            prompt = TWEET_RULE_DESCRIPTIONS[archetype]
            op.execute(
                sa.text(
                    """
                INSERT INTO agent_prompts (agent_id, version, system_prompt, source, is_active)
                SELECT id, 1, :prompt, 'initial', true
                FROM agents WHERE name = :name
                """
                ).bindparams(prompt=prompt, name=rule_name)
            )

    # 5. Insert prompts for LLM tweet agents
    for tf in TIMEFRAMES:
        for archetype, _ in TWEET_ARCHETYPES:
            llm_name = f"tw-llm-{archetype.replace('tweet_', '')}-{tf}"
            prompt = TWEET_LLM_PROMPTS[archetype]
            op.execute(
                sa.text(
                    """
                INSERT INTO agent_prompts (agent_id, version, system_prompt, source, is_active)
                SELECT id, 1, :prompt, 'initial', true
                FROM agents WHERE name = :name
                """
                ).bindparams(prompt=prompt, name=llm_name)
            )


def downgrade() -> None:
    op.execute("DELETE FROM agent_prompts WHERE agent_id IN (SELECT id FROM agents WHERE source = 'tweet')")
    op.execute("DELETE FROM agent_portfolios WHERE agent_id IN (SELECT id FROM agents WHERE source = 'tweet')")
    op.execute("DELETE FROM agents WHERE source = 'tweet'")
    op.drop_column("agents", "source")
