"""Seed 48 hybrid agents (technical + tweet sentiment).

Revision ID: 014
Revises: 013
Create Date: 2026-02-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d", "1w"]

HYBRID_ARCHETYPES = [
    ("hybrid_momentum", "HYB Momentum Trader"),
    ("hybrid_mean_reversion", "HYB Mean Reversion Trader"),
    ("hybrid_breakout", "HYB Breakout Trader"),
    ("hybrid_swing", "HYB Swing Trader"),
]

# System prompts for LLM hybrid agents
HYBRID_LLM_PROMPTS = {
    "hybrid_momentum": """You are a crypto trading agent that combines technical momentum analysis with social media intelligence.

Primary signals: RSI, MACD histogram, ADX trend strength, EMA alignment, OBV volume confirmation.
Secondary signals: Tweet sentiment from tracked crypto accounts.

Entry rules:
- Require strong technical momentum setup (RSI 50-70 for long, 30-50 for short, MACD confirming, ADX > 25, EMA alignment).
- When technical and tweet signals agree (sentiment > 0.3 for long, < -0.3 for short), increase position size up to 20%.
- When they conflict (e.g., bullish technicals but bearish tweets), skip the trade entirely.
- Never trade on tweets alone — always require technical confirmation first.

Exit rules:
- Exit on RSI extremes (> 75 long, < 25 short) or EMA20 cross.
- Accelerate exit if tweet sentiment strongly reverses (flips with >= 3 signals).

Risk management:
- Position size: 8-20% depending on confidence and tweet alignment.
- Stop loss: 4%. Take profit: 6%.
- Maximum 3 concurrent positions.""",

    "hybrid_mean_reversion": """You are a crypto trading agent that combines mean reversion analysis with social media sentiment as a contrarian filter.

Primary signals: RSI oversold/overbought, Bollinger Band extremes, Stochastic crossover, EMA200 trend filter.
Secondary signals: Tweet sentiment — used as contrarian confirmation.

Entry rules:
- Require technical mean reversion setup (RSI < 30 or %B < 0.05 for long, RSI > 70 or %B > 0.95 for short).
- Tweet boost: Extreme crowd fear (avg_sentiment <= -0.5) confirms oversold longs — increase size to 15%.
- Tweet conflict: If tweets are euphoric during an oversold signal, skip — the crowd agreeing means it's not a true contrarian setup.
- Mirror logic for shorts: extreme greed confirms overbought shorts.
- Never trade on tweets alone — always require technical extremes first.

Exit rules:
- Exit when price returns to mean (EMA20 proximity or RSI normalizes to 50).

Risk management:
- Position size: 10-15% depending on tweet confirmation.
- Stop loss: 3%. Take profit: 4%.
- Maximum 5 concurrent positions.""",

    "hybrid_breakout": """You are a crypto trading agent that combines Bollinger Band breakout detection with social media intelligence.

Primary signals: BB bandwidth squeeze, price breaking above/below bands, OBV volume spike, ADX trend emergence.
Secondary signals: Tweet sentiment and symbol mentions.

Entry rules:
- Require technical breakout setup (BB squeeze + price beyond bands + volume surge + ADX < 25).
- Tweet boost: If the breakout symbol appears in most-mentioned tweet symbols, increase size from 8% to 12%.
- Tweet conflict: If tweet sentiment opposes breakout direction, reduce size by 50% (still trade, but smaller).
- Never trade on tweets alone — always require the technical breakout first.

Exit rules:
- Exit if price re-enters Bollinger Bands (false breakout).

Risk management:
- Position size: 4-12% depending on tweet alignment.
- Stop loss: 5%. Take profit: 10%.
- Maximum 2 concurrent positions — be very selective.""",

    "hybrid_swing": """You are a crypto trading agent that combines swing trading with social media sentiment confirmation.

Primary signals: RSI pullback zones, EMA50/200 alignment, Stochastic crossover, ADX trend strength.
Secondary signals: Tweet sentiment alignment and conviction.

Entry rules:
- Require technical swing setup (trending market ADX > 20, pullback to EMA support, Stoch turning).
- Tweet boost: If tweet sentiment aligns with entry direction (> 0.3 for long, < -0.3 for short) with >= 2 signals, increase size by 5%.
- Tweet conflict: If tweet sentiment opposes direction (< -0.2 for long, > 0.2 for short), skip the trade.
- Never trade on tweets alone — always require the technical pullback setup first.

Exit rules:
- Exit on RSI extremes (>= 70 long, <= 30 short) or EMA200 trend break.
- Accelerate exit if tweet sentiment reversal confirmed (>= 3 opposing signals).

Risk management:
- Position size: 12-25% depending on confidence and tweet alignment.
- Stop loss: 4%. Take profit: 8%.
- Maximum 3 concurrent positions.""",
}

# Rule descriptions for documentation (stored as prompts for rule-based agents)
HYBRID_RULE_DESCRIPTIONS = {
    "hybrid_momentum": """Rule-based Hybrid Momentum Trader.

Combines technical momentum with tweet sentiment confirmation.
Entry Long: bullish_score >= 0.70 (0.60 with tweet boost), RSI 50-70, MACD > 0, ADX > 25, EMA alignment, OBV > 0.
  Tweet boost: avg_sentiment > 0.3 + bullish_count >= 2 → relax threshold to 0.60, size to 20%.
  Tweet conflict: avg_sentiment < -0.2 → skip long.
Entry Short: mirror conditions with tweet sentiment inverted.
Exit: RSI extremes or EMA20 cross + tweet sentiment reversal (>= 3 opposing signals).
Sizing: 8-20%. SL 4%, TP 6%.""",

    "hybrid_mean_reversion": """Rule-based Hybrid Mean Reversion Trader.

Combines mean reversion with tweet sentiment as contrarian filter.
Entry Long: uptrend (EMA200) + oversold (RSI < 30 or %B < 0.05) + Stoch turning up.
  Tweet boost: extreme fear (avg_sentiment <= -0.5) → increase size to 15%.
  Tweet conflict: euphoric tweets (avg_sentiment >= 0.4) during oversold → skip (crowd agrees = not contrarian).
Entry Short: downtrend + overbought, mirror tweet logic.
Exit: price returns to mean (EMA20 or RSI normalizes).
Sizing: 10-15%. SL 3%, TP 4%.""",

    "hybrid_breakout": """Rule-based Hybrid Breakout Trader.

Combines BB breakout detection with tweet mentions/sentiment.
Entry Long: BB squeeze + price > upper BB + OBV spike + ADX < 25.
  Tweet boost: symbol in most_mentioned_symbols → size 12% (from 8%).
  Tweet conflict: avg_sentiment < -0.2 → reduce size by 50%.
Entry Short: mirror conditions.
Exit: price re-enters BB (false breakout).
Sizing: 4-12%. SL 5%, TP 10%.""",

    "hybrid_swing": """Rule-based Hybrid Swing Trader.

Combines swing trading with tweet sentiment confirmation.
Entry Long: ADX > 20 + EMA alignment + RSI pullback (40-55) + Stoch turning up.
  Tweet boost: avg_sentiment > 0.3 + bullish_count >= 2 → size +5%.
  Tweet conflict: avg_sentiment < -0.2 + bearish_count >= 2 → skip.
Entry Short: mirror conditions.
Exit: RSI extremes or EMA200 break + tweet sentiment reversal (>= 3 opposing).
Sizing: 12-25%. SL 4%, TP 8%.""",
}


def upgrade() -> None:
    # 0. Widen strategy_archetype column from VARCHAR(20) to VARCHAR(30)
    op.alter_column(
        "agents", "strategy_archetype",
        type_=sa.String(30), existing_type=sa.String(20),
    )
    op.alter_column(
        "backtest_runs", "strategy_archetype",
        type_=sa.String(30), existing_type=sa.String(20),
    )

    # 1. Seed 48 hybrid agents (4 archetypes x 6 TFs x 2 engines)
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

    hybrid_agents = []
    for tf in TIMEFRAMES:
        for archetype, display in HYBRID_ARCHETYPES:
            short_arch = archetype.replace("hybrid_", "")

            # Rule-based agent
            rule_name = f"hyb-{short_arch}-{tf}"
            rule_display = f"{display} ({tf.upper()})"
            hybrid_agents.append({
                "name": rule_name,
                "display_name": rule_display,
                "strategy_archetype": archetype,
                "timeframe": tf,
                "scan_model": "none",
                "trade_model": "none",
                "evolution_model": "none",
                "engine": "rule",
                "source": "hybrid",
            })

            # LLM agent
            llm_name = f"hyb-llm-{short_arch}-{tf}"
            llm_display = f"HYB-LLM {display.replace('HYB ', '')} ({tf.upper()})"
            hybrid_agents.append({
                "name": llm_name,
                "display_name": llm_display,
                "strategy_archetype": archetype,
                "timeframe": tf,
                "scan_model": "claude-haiku-4-5-20251001",
                "trade_model": "claude-haiku-4-5-20251001",
                "evolution_model": "claude-haiku-4-5-20251001",
                "engine": "llm",
                "source": "hybrid",
            })

    op.bulk_insert(agents_table, hybrid_agents)

    # 2. Initialize portfolios for all new hybrid agents
    op.execute(
        """
        INSERT INTO agent_portfolios (agent_id, cash_balance, total_equity)
        SELECT id, initial_balance, initial_balance FROM agents
        WHERE source = 'hybrid' AND id NOT IN (SELECT agent_id FROM agent_portfolios);
        """
    )

    # 3. Insert prompts for rule-based hybrid agents
    for tf in TIMEFRAMES:
        for archetype, _ in HYBRID_ARCHETYPES:
            short_arch = archetype.replace("hybrid_", "")
            rule_name = f"hyb-{short_arch}-{tf}"
            prompt = HYBRID_RULE_DESCRIPTIONS[archetype]
            op.execute(
                sa.text(
                    """
                INSERT INTO agent_prompts (agent_id, version, system_prompt, source, is_active)
                SELECT id, 1, :prompt, 'initial', true
                FROM agents WHERE name = :name
                """
                ).bindparams(prompt=prompt, name=rule_name)
            )

    # 4. Insert prompts for LLM hybrid agents
    for tf in TIMEFRAMES:
        for archetype, _ in HYBRID_ARCHETYPES:
            short_arch = archetype.replace("hybrid_", "")
            llm_name = f"hyb-llm-{short_arch}-{tf}"
            prompt = HYBRID_LLM_PROMPTS[archetype]
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
    op.execute("DELETE FROM agent_prompts WHERE agent_id IN (SELECT id FROM agents WHERE source = 'hybrid')")
    op.execute("DELETE FROM agent_portfolios WHERE agent_id IN (SELECT id FROM agents WHERE source = 'hybrid')")
    op.execute("DELETE FROM agents WHERE source = 'hybrid'")
    op.alter_column(
        "agents", "strategy_archetype",
        type_=sa.String(20), existing_type=sa.String(30),
    )
    op.alter_column(
        "backtest_runs", "strategy_archetype",
        type_=sa.String(20), existing_type=sa.String(30),
    )
