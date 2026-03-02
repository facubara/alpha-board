#!/usr/bin/env python3
"""
Generate Season 1 agent review files.

Queries the live worker API for each of the 26 rule-based agents,
computes derived metrics, applies verdict logic, and generates
individual .md review files + an _index.md scorecard.

Usage:
    python scripts/generate_season1_reviews.py
"""

import asyncio
import httpx
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, field

API_BASE = "https://alpha-worker.fly.dev"
OUTPUT_DIR = Path(__file__).parent.parent / "docs" / "season-1"

# The 26 rule-based agents with trades (sorted by ID)
AGENT_IDS = [
    30, 34, 38, 39, 41, 42, 43, 44, 45, 46, 48, 49, 50,
    153, 161, 169, 171, 175, 177, 179, 181, 183, 185, 189, 191, 193,
]

# Strategy parameters extracted from worker/src/agents/strategies/*.py
STRATEGY_PARAMS = {
    "momentum": {
        "sl": 4, "tp": 6, "size": "8-15%",
        "entry": "Score >= 0.70, RSI 50-70, MACD > 0, ADX > 25",
        "exit": "RSI > 75 or price < EMA20 (long) / RSI < 25 or price > EMA20 (short)",
    },
    "mean_reversion": {
        "sl": 3, "tp": 4, "size": "10%",
        "entry": "RSI < 30 or BB %B < 0.05, Stoch K < 20 & K > D, Score 0.20-0.45",
        "exit": "|price vs EMA20| < 0.3 or RSI 50-60 (long) / RSI 40-50 (short)",
    },
    "breakout": {
        "sl": 5, "tp": 10, "size": "8%",
        "entry": "BB bandwidth < 5 (squeeze), %B > 1.0, OBV slope > 2.0, ADX < 25",
        "exit": "Price returns inside BB (0.0 <= %B <= 1.0)",
    },
    "swing": {
        "sl": 4, "tp": 8, "size": "12-20%",
        "entry": "EMA50 > EMA200, Score >= 0.55, RSI 40-55, Stoch K < 50 & K > D, ADX >= 20",
        "exit": "RSI >= 70 or price vs EMA200 < 0 (long) / RSI <= 30 or price vs EMA200 > 0 (short)",
    },
    "hybrid_momentum": {
        "sl": 4, "tp": 6, "size": "8-20%",
        "entry": "Base momentum + tweet sentiment (threshold relaxed 0.70 -> 0.60 on bullish tweets)",
        "exit": "Base momentum exit + tweet reversal (sentiment < -0.3 with 3+ bearish tweets)",
    },
    "hybrid_mean_reversion": {
        "sl": 3, "tp": 4, "size": "10-15%",
        "entry": "Base MR + contrarian tweet filter (skip if crowd agrees with entry direction)",
        "exit": "Base MR exit",
    },
    "hybrid_breakout": {
        "sl": 5, "tp": 10, "size": "8-12%",
        "entry": "Base breakout + size boost to 12% if symbol trending on Twitter",
        "exit": "Base breakout exit",
    },
    "hybrid_swing": {
        "sl": 4, "tp": 8, "size": "12-25%",
        "entry": "Base swing + tweet conflict filter + sentiment size boost (+5%, max 25%)",
        "exit": "Base swing exit + accelerated exit on strong opposing sentiment",
    },
}

STRATEGY_OVERVIEWS = {
    "momentum": (
        "Trend-following on strong moves. Enters long when bullish score >= 0.70, RSI 50-70, "
        "MACD histogram > 0, ADX > 25. Short when score <= 0.30 with bearish confirmations. "
        "SL 4%, TP 6% (1.5:1 ratio). Position size 15% at high confidence, 8% otherwise. "
        "Exits on RSI extremes (>75/<25) or EMA20 cross."
    ),
    "mean_reversion": (
        "Contrarian bounce trades at extremes. Enters long in uptrend (above EMA200) when "
        "RSI < 30 or BB %B < 0.05 with Stochastic confirmation (K < 20, K > D). "
        "SL 3%, TP 4% (1.33:1 ratio) - tight TP:SL requires high win rate to profit. "
        "Position size 10%. Exits when price reverts to mean (near EMA20)."
    ),
    "breakout": (
        "Volatility squeeze breakouts. Enters when BB bandwidth < 5 (squeeze) and price "
        "breaks above/below bands with volume confirmation (OBV slope > 2.0). ADX < 25 "
        "confirms emerging (not established) trend. SL 5%, TP 10% (2:1 ratio). "
        "Position size 8%. Exits when price returns inside Bollinger Bands."
    ),
    "swing": (
        "Multi-day trend capture using EMA alignment. Enters when EMA50 > EMA200 (uptrend), "
        "score >= 0.55, RSI in neutral zone (40-55), Stochastic < 50 with bullish cross, "
        "ADX >= 20 (trending). SL 4%, TP 8% (2:1 ratio). Large position sizes (12-20%). "
        "Exits on RSI >= 70 or EMA200 breakdown."
    ),
    "hybrid_momentum": (
        "Base momentum strategy enhanced with Twitter sentiment. Entry threshold relaxed "
        "from 0.70 to 0.60 when bullish tweets detected (avg_sentiment > 0.3, 2+ bullish). "
        "Position size boosted to 20% on tweet confirmation. Skips entry on tweet conflict "
        "(opposing sentiment). Additional exit on strong tweet reversal signal."
    ),
    "hybrid_mean_reversion": (
        "Base mean reversion with contrarian tweet filter. Skips long entry if crowd is too "
        "bullish (sentiment >= 0.4 with 3+ bullish tweets) — avoids catching falling knives "
        "when everyone agrees. Size boosted to 15% on extreme fear (sentiment <= -0.5). "
        "Short entry skipped if crowd too bearish."
    ),
    "hybrid_breakout": (
        "Base breakout with Twitter mention boost. Position size increased from 8% to 12% "
        "when the breakout symbol appears in trending Twitter mentions. Size reduced by 50% "
        "on sentiment conflict (bearish tweets during long breakout or vice versa)."
    ),
    "hybrid_swing": (
        "Base swing strategy with tweet sentiment overlay. Skips entry when tweets conflict "
        "with direction (e.g., bearish tweets during long setup). Size boosted by 5% "
        "(max 25%) when tweets confirm. Accelerated exit triggered when 3+ tweets oppose "
        "the position direction with strong sentiment."
    ),
}

# Timeframe to hours mapping
TF_HOURS = {"15m": 0.25, "30m": 0.5, "1h": 1, "4h": 4, "1d": 24, "1w": 168}


@dataclass
class Metrics:
    net_pnl: float = 0.0
    return_pct: float = 0.0
    total_equity: float = 0.0
    initial_balance: float = 10000.0
    trade_count: int = 0
    wins: int = 0
    losses: int = 0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    win_loss_ratio: float = 0.0
    expectancy: float = 0.0
    profit_factor: float = 0.0
    total_fees: float = 0.0
    fee_ratio: float = 0.0
    open_positions: int = 0
    best_trade: dict = field(default_factory=dict)
    worst_trade: dict = field(default_factory=dict)
    exit_breakdown: dict = field(default_factory=dict)
    longs: int = 0
    shorts: int = 0
    long_wr: float = 0.0
    short_wr: float = 0.0
    avg_duration_hours: float = 0.0


def compute_metrics(agent: dict, trades: list, positions: list) -> Metrics:
    m = Metrics()
    m.initial_balance = agent["initialBalance"]
    m.total_equity = agent["totalEquity"]
    m.open_positions = len(positions)
    m.trade_count = len(trades)

    if not trades:
        return m

    winning = [t for t in trades if t["pnl"] > 0]
    losing = [t for t in trades if t["pnl"] <= 0]

    m.net_pnl = sum(t["pnl"] for t in trades)
    m.return_pct = m.net_pnl / m.initial_balance * 100
    m.total_fees = sum(t["fees"] for t in trades)
    m.wins = len(winning)
    m.losses = len(losing)
    m.win_rate = m.wins / m.trade_count * 100

    m.avg_win = sum(t["pnl"] for t in winning) / len(winning) if winning else 0
    m.avg_loss = sum(t["pnl"] for t in losing) / len(losing) if losing else 0
    m.win_loss_ratio = abs(m.avg_win / m.avg_loss) if m.avg_loss != 0 else float("inf")
    m.expectancy = m.net_pnl / m.trade_count

    gross_win = sum(t["pnl"] for t in winning)
    gross_loss_abs = abs(sum(t["pnl"] for t in losing))
    m.profit_factor = gross_win / gross_loss_abs if gross_loss_abs > 0 else float("inf")

    # Fee ratio: total fees as % of gross winning PnL (before fees)
    gross_winning_before_fees = sum(t["pnl"] + t["fees"] for t in winning)
    m.fee_ratio = (
        (m.total_fees / gross_winning_before_fees * 100)
        if gross_winning_before_fees > 0
        else float("inf")
    )

    m.best_trade = max(trades, key=lambda t: t["pnl"])
    m.worst_trade = min(trades, key=lambda t: t["pnl"])

    breakdown = {}
    for t in trades:
        r = t["exitReason"]
        breakdown[r] = breakdown.get(r, 0) + 1
    m.exit_breakdown = breakdown

    long_trades = [t for t in trades if t["direction"] == "long"]
    short_trades = [t for t in trades if t["direction"] == "short"]
    m.longs = len(long_trades)
    m.shorts = len(short_trades)
    m.long_wr = (
        len([t for t in long_trades if t["pnl"] > 0]) / m.longs * 100
        if m.longs > 0
        else 0
    )
    m.short_wr = (
        len([t for t in short_trades if t["pnl"] > 0]) / m.shorts * 100
        if m.shorts > 0
        else 0
    )

    durations = [t["durationMinutes"] for t in trades if t.get("durationMinutes")]
    m.avg_duration_hours = (sum(durations) / len(durations) / 60) if durations else 0

    return m


def determine_verdict(agent: dict, m: Metrics) -> tuple:
    """Returns (verdict, reason) tuple."""
    archetype = agent["strategyArchetype"]
    tf = agent["timeframe"]
    tf_h = TF_HOURS.get(tf, 0)

    # KEEP: positive realized PnL AND positive expectancy
    if m.net_pnl > 0 and m.expectancy > 0:
        return (
            "KEEP",
            f"Positive PnL (${m.net_pnl:+.2f}) with positive expectancy (${m.expectancy:.2f}/trade)",
        )

    # DISCARD: mean reversion on 4h+ with WR < 35%
    is_mr = "mean_reversion" in archetype
    if is_mr and tf_h >= 4 and m.win_rate < 35:
        return (
            "DISCARD",
            f"Mean reversion on {tf} with {m.win_rate:.1f}% WR — structural mismatch "
            f"(needs high WR to compensate tight 1.33:1 TP:SL)",
        )

    # DISCARD: 20+ trades AND PnL < -$500 AND expectancy < -$5/trade
    if m.trade_count >= 20 and m.net_pnl < -500 and m.expectancy < -5:
        return (
            "DISCARD",
            f"Statistically significant losses: {m.trade_count} trades, "
            f"${m.net_pnl:,.2f} PnL, ${m.expectancy:.2f}/trade expectancy",
        )

    # DISCARD: fee ratio > 150% with no fix path
    if m.fee_ratio > 150 and m.trade_count >= 10:
        return (
            "DISCARD",
            f"Fees ({m.fee_ratio:.0f}% of gross) consuming all profits — no viable fix path",
        )

    # TUNE: everything else
    if m.trade_count < 5:
        reason = f"Too few trades ({m.trade_count}) for statistical significance — needs more data"
    elif -50 <= m.net_pnl <= 0:
        reason = "Near breakeven — fixable with parameter tuning"
    elif m.win_rate > 45 and m.expectancy < 0:
        reason = (
            f"Decent WR ({m.win_rate:.1f}%) but negative expectancy "
            f"(${m.expectancy:.2f}/trade) — poor TP:SL or fee drag"
        )
    else:
        reason = f"Negative PnL (${m.net_pnl:,.2f}) but parameters may be tunable"

    return ("TUNE", reason)


def generate_strengths(m: Metrics, trades: list) -> list:
    strengths = []
    if m.win_rate >= 50:
        strengths.append(
            f"Above-average win rate ({m.win_rate:.1f}%) suggests good entry timing"
        )
    if m.win_loss_ratio >= 2 and m.win_loss_ratio != float("inf"):
        strengths.append(
            f"Strong win/loss ratio ({m.win_loss_ratio:.1f}:1) — winners outsize losers"
        )
    if m.profit_factor >= 1 and m.profit_factor != float("inf"):
        strengths.append(f"Profit factor above 1.0 ({m.profit_factor:.2f})")
    if m.avg_win > 50:
        strengths.append(f"Solid average winning trade (${m.avg_win:.2f})")
    if m.long_wr >= 50 and m.longs >= 3:
        strengths.append(
            f"Strong on longs ({m.long_wr:.0f}% WR across {m.longs} trades)"
        )
    if m.short_wr >= 50 and m.shorts >= 3:
        strengths.append(
            f"Strong on shorts ({m.short_wr:.0f}% WR across {m.shorts} trades)"
        )
    if m.fee_ratio < 20 and m.total_fees > 0 and m.fee_ratio != float("inf"):
        strengths.append(f"Low fee impact ({m.fee_ratio:.1f}% of gross profits)")
    tp_count = m.exit_breakdown.get("take_profit", 0)
    if tp_count >= m.trade_count * 0.3 and m.trade_count > 0:
        tp_pct = tp_count / m.trade_count * 100
        strengths.append(f"Healthy TP hit rate ({tp_pct:.0f}% of exits)")
    if not strengths:
        strengths.append("Limited positive signals in current data")
    return strengths


def generate_weaknesses(agent: dict, m: Metrics) -> list:
    archetype = agent["strategyArchetype"]
    weaknesses = []
    if m.win_rate < 35:
        weaknesses.append(f"Low win rate ({m.win_rate:.1f}%) — most entries fail")
    if m.win_loss_ratio < 1.5 and m.win_loss_ratio > 0 and m.trade_count > 0:
        weaknesses.append(
            f"Poor win/loss ratio ({m.win_loss_ratio:.1f}:1) — "
            f"winners don't compensate for losers"
        )
    if m.fee_ratio > 50 and m.fee_ratio != float("inf"):
        weaknesses.append(
            f"High fee ratio ({m.fee_ratio:.1f}% of gross) — fees eating into profits"
        )
    if m.expectancy < -5:
        weaknesses.append(
            f"Negative expectancy (${m.expectancy:.2f}/trade) — "
            f"losing money on average per trade"
        )
    sl_count = m.exit_breakdown.get("stop_loss", 0)
    if m.trade_count > 0:
        sl_pct = sl_count / m.trade_count * 100
        if sl_pct > 50:
            weaknesses.append(
                f"High stop-loss rate ({sl_pct:.0f}%) — entries frequently wrong-footed"
            )
    if m.avg_win > 0 and abs(m.avg_loss) > m.avg_win:
        weaknesses.append(
            f"Avg loss (${abs(m.avg_loss):.2f}) exceeds avg win (${m.avg_win:.2f})"
        )
    if "mean_reversion" in archetype:
        params = STRATEGY_PARAMS.get(archetype, {})
        tp_val = params.get("tp", 4)
        sl_val = params.get("sl", 3)
        ratio = tp_val / sl_val
        if ratio < 1.5:
            weaknesses.append(
                f"Tight TP:SL ratio ({ratio:.2f}:1) requires very high WR to be profitable"
            )
    if m.long_wr < 30 and m.longs >= 5:
        weaknesses.append(
            f"Weak on longs ({m.long_wr:.0f}% WR across {m.longs} trades)"
        )
    if m.short_wr < 30 and m.shorts >= 5:
        weaknesses.append(
            f"Weak on shorts ({m.short_wr:.0f}% WR across {m.shorts} trades)"
        )
    if not weaknesses:
        weaknesses.append("No critical weaknesses identified (small sample size)")
    return weaknesses


def generate_recommendations(agent: dict, m: Metrics, verdict: str) -> str:
    archetype = agent["strategyArchetype"]
    params = STRATEGY_PARAMS.get(archetype, {})
    tf = agent["timeframe"]

    if verdict == "KEEP":
        lines = [
            "**Status: Continue running.** Monitor these metrics going forward:",
            "",
            f"- Watch for win rate regression below {max(m.win_rate - 10, 30):.0f}%",
            "- Track expectancy — flag if drops below $0/trade",
            f"- Current fee ratio ({m.fee_ratio:.1f}%) is manageable but monitor"
            if m.fee_ratio != float("inf")
            else "- Monitor fee ratio",
        ]
        if m.open_positions > 0:
            lines.append(
                f"- {m.open_positions} open position(s) — watch for concentration risk"
            )
        return "\n".join(lines)

    if verdict == "DISCARD":
        lines = []
        is_mr = "mean_reversion" in archetype
        if is_mr and TF_HOURS.get(tf, 0) >= 4:
            lines.append(
                f"**Structural mismatch**: Mean reversion on {tf} timeframe doesn't work. "
                f"The 3% SL / 4% TP (1.33:1 ratio) requires >57% WR to break even, "
                f"but {tf} mean reversion only achieves {m.win_rate:.1f}% WR. "
                f"Longer timeframes trend — they don't revert."
            )
            lines.append("")
            lines.append(
                "**Action**: Remove from fleet. The archetype/timeframe combination "
                "is fundamentally flawed — parameter tuning cannot fix this."
            )
        elif m.trade_count >= 20 and m.net_pnl < -500:
            lines.append(
                f"**Statistical confidence**: With {m.trade_count} trades and "
                f"${m.net_pnl:,.2f} PnL, this is not a small sample fluke. "
                f"Expectancy of ${m.expectancy:.2f}/trade means every additional "
                f"trade loses money."
            )
            lines.append("")
            lines.append(
                "**Action**: Remove from fleet. Would need fundamental strategy "
                "redesign, not parameter tuning."
            )
        else:
            lines.append(
                f"**Fee destruction**: Fees consume {m.fee_ratio:.0f}% of gross winning PnL. "
                f"Even with parameter changes, the strategy's edge cannot overcome "
                f"transaction costs at this trade frequency."
            )
            lines.append("")
            lines.append("**Action**: Remove from fleet.")
        return "\n".join(lines)

    # TUNE
    lines = [
        "**Recommended parameter changes:**",
        "",
        "| Parameter | Current | Proposed | Rationale |",
        "|-----------|---------|----------|-----------|",
    ]

    tp_val = params.get("tp", 4)
    sl_val = params.get("sl", 3)

    # Fee ratio > 50% → widen TP
    if m.fee_ratio > 50 and m.fee_ratio != float("inf"):
        new_tp = round(tp_val * 1.5, 1)
        lines.append(
            f"| Take Profit | {tp_val}% | {new_tp}% | "
            f"Widen TP to reduce fee impact (current fee ratio: {m.fee_ratio:.0f}%) |"
        )

    # TP:SL < 2:1 → widen TP to achieve 2:1
    tp_sl_ratio = tp_val / sl_val if sl_val > 0 else 0
    if tp_sl_ratio < 2:
        new_tp = sl_val * 2
        lines.append(
            f"| Take Profit | {tp_val}% | {new_tp}% | "
            f"Improve TP:SL from {tp_sl_ratio:.1f}:1 to 2.0:1 |"
        )

    # WR < 35% → tighten entry filters
    if m.win_rate < 35:
        lines.append(
            f"| Entry threshold | Current | +10% stricter | "
            f"Tighten entry filters — {m.win_rate:.1f}% WR suggests too many bad entries |"
        )

    # Too few trades (< 5) → relax entry thresholds
    if m.trade_count < 5:
        lines.append(
            f"| Entry threshold | Current | -10% looser | "
            f"Only {m.trade_count} trades in season — relax to generate more signals for evaluation |"
        )

    # High stop-loss rate → tighten SL
    sl_count = m.exit_breakdown.get("stop_loss", 0)
    if m.trade_count > 0 and sl_count / m.trade_count > 0.6:
        new_sl = round(sl_val * 0.75, 1)
        lines.append(
            f"| Stop Loss | {sl_val}% | {new_sl}% | "
            f"Tighten SL — {sl_count}/{m.trade_count} trades hit stop ({sl_count/m.trade_count*100:.0f}%) |"
        )

    # Hybrid note about tweet data
    if archetype.startswith("hybrid_"):
        lines.append(
            "| Tweet integration | N/A | Verify | "
            "Twitter data was limited in Season 1 — evaluate hybrid value when full data available |"
        )

    return "\n".join(lines)


def format_trade_ref(t: dict) -> str:
    sign = "+" if t["pnl"] > 0 else ""
    return f"{t['symbol']} {t['direction']} {sign}${t['pnl']:.2f} ({t['exitReason']})"


def generate_review_md(
    agent: dict, trades: list, positions: list, m: Metrics, verdict: str, reason: str
) -> str:
    archetype = agent["strategyArchetype"]
    strengths = generate_strengths(m, trades)
    weaknesses = generate_weaknesses(agent, m)
    recommendations = generate_recommendations(agent, m, verdict)

    # Format special values
    wl_display = (
        f"{m.win_loss_ratio:.1f}:1"
        if m.win_loss_ratio != float("inf")
        else "N/A (no losses)"
    )
    pf_display = (
        f"{m.profit_factor:.2f}"
        if m.profit_factor != float("inf")
        else "N/A (no losses)"
    )
    fr_display = (
        f"{m.fee_ratio:.0f}%"
        if m.fee_ratio != float("inf")
        else "N/A (no gross wins)"
    )

    # Exit breakdown
    exit_parts = []
    for key in ["stop_loss", "take_profit", "agent_decision"]:
        count = m.exit_breakdown.get(key, 0)
        exit_parts.append(f"{count} {key}")
    exit_str = " / ".join(exit_parts)

    # Direction split
    dir_str = (
        f"{m.longs} long ({m.long_wr:.0f}%) / {m.shorts} short ({m.short_wr:.0f}%)"
    )

    md = f"""# {agent['displayName']} — Season 1 Review

> Agent: `{agent['name']}` | ID: {agent['id']} | Archetype: {archetype} | Timeframe: {agent['timeframe']} | Engine: rule | Source: {agent['source']}

## Verdict: {verdict}
{reason}

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | ${m.net_pnl:+,.2f} |
| Return | {m.return_pct:+.1f}% |
| Total Equity | ${m.total_equity:,.2f} |
| Trades | {m.trade_count} ({m.wins}W / {m.losses}L) |
| Win Rate | {m.win_rate:.1f}% |
| Avg Win | ${m.avg_win:.2f} |
| Avg Loss | -${abs(m.avg_loss):.2f} |
| Win/Loss Ratio | {wl_display} |
| Expectancy/Trade | ${m.expectancy:.2f} |
| Profit Factor | {pf_display} |
| Total Fees | ${m.total_fees:.2f} ({fr_display} of gross) |
| Open Positions | {m.open_positions} |

## Strategy Overview
{STRATEGY_OVERVIEWS.get(archetype, 'N/A')}

## Strengths
"""
    for s in strengths:
        md += f"- {s}\n"

    md += "\n## Weaknesses\n"
    for w in weaknesses:
        md += f"- {w}\n"

    md += "\n## Trade Analysis\n"
    if trades:
        md += f"- **Best trade**: {format_trade_ref(m.best_trade)}\n"
        md += f"- **Worst trade**: {format_trade_ref(m.worst_trade)}\n"
        md += f"- **Exit breakdown**: {exit_str}\n"
        md += f"- **Direction split**: {dir_str}\n"
        md += f"- **Avg duration**: {m.avg_duration_hours:.1f}h\n"
    else:
        md += "- No closed trades to analyze\n"

    md += f"\n## Recommendations\n{recommendations}\n"

    return md


def generate_index_md(results: list) -> str:
    results.sort(key=lambda r: r["metrics"].net_pnl, reverse=True)

    keeps = [r for r in results if r["verdict"] == "KEEP"]
    tunes = [r for r in results if r["verdict"] == "TUNE"]
    discards = [r for r in results if r["verdict"] == "DISCARD"]

    total_pnl = sum(r["metrics"].net_pnl for r in results)
    total_trades = sum(r["metrics"].trade_count for r in results)
    total_fees = sum(r["metrics"].total_fees for r in results)

    best = results[0] if results else None
    worst = results[-1] if results else None

    md = f"""# Season 1 — Agent Scorecard

## Fleet Summary

| Metric | Value |
|--------|-------|
| Total Agents | {len(results)} |
| KEEP | {len(keeps)} |
| TUNE | {len(tunes)} |
| DISCARD | {len(discards)} |
| Fleet PnL | ${total_pnl:+,.2f} |
| Total Trades | {total_trades} |
| Total Fees | ${total_fees:,.2f} |
| Best Agent | {best['agent']['name'] if best else 'N/A'} (${best['metrics'].net_pnl:+,.2f}) |
| Worst Agent | {worst['agent']['name'] if worst else 'N/A'} (${worst['metrics'].net_pnl:+,.2f}) |

## All Agents

| # | Agent | Archetype | TF | PnL | Trades | WR | Expectancy | Verdict |
|---|-------|-----------|-----|-----|--------|-----|------------|---------|
"""
    for i, r in enumerate(results, 1):
        a = r["agent"]
        m = r["metrics"]
        v = r["verdict"]
        md += (
            f"| {i} | [{a['name']}]({a['name']}.md) | {a['strategyArchetype']} "
            f"| {a['timeframe']} | ${m.net_pnl:+,.2f} | {m.trade_count} "
            f"| {m.win_rate:.0f}% | ${m.expectancy:.2f} | **{v}** |\n"
        )

    # Verdict breakdown sections
    if keeps:
        md += "\n## KEEP Agents\n"
        for r in keeps:
            md += f"- **{r['agent']['name']}** — {r['reason']}\n"

    if tunes:
        md += "\n## TUNE Agents\n"
        for r in sorted(tunes, key=lambda x: x["metrics"].net_pnl, reverse=True):
            md += f"- **{r['agent']['name']}** — {r['reason']}\n"

    if discards:
        md += "\n## DISCARD Agents\n"
        for r in sorted(discards, key=lambda x: x["metrics"].net_pnl):
            md += f"- **{r['agent']['name']}** — {r['reason']}\n"

    md += (
        f"\n---\n\n*Generated on "
        f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} "
        f"from live API data.*\n"
    )

    return md


async def fetch_agent_data(client: httpx.AsyncClient, agent_id: int) -> tuple:
    agent_resp = await client.get(f"{API_BASE}/agents/{agent_id}")
    trades_resp = await client.get(f"{API_BASE}/agents/{agent_id}/trades")
    positions_resp = await client.get(f"{API_BASE}/agents/{agent_id}/positions")
    return agent_resp.json(), trades_resp.json(), positions_resp.json()


async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    results = []

    print(f"Fetching data for {len(AGENT_IDS)} agents...")
    async with httpx.AsyncClient(timeout=60) as client:
        tasks = [fetch_agent_data(client, aid) for aid in AGENT_IDS]
        responses = await asyncio.gather(*tasks)

    print("Generating reviews...\n")
    for agent, trades, positions in responses:
        m = compute_metrics(agent, trades, positions)
        verdict, reason = determine_verdict(agent, m)

        md = generate_review_md(agent, trades, positions, m, verdict, reason)
        filepath = OUTPUT_DIR / f"{agent['name']}.md"
        filepath.write_text(md, encoding="utf-8")
        print(f"  {verdict:>7}  {agent['name']}")

        results.append(
            {
                "agent": agent,
                "trades": trades,
                "positions": positions,
                "metrics": m,
                "verdict": verdict,
                "reason": reason,
            }
        )

    # Generate index scorecard
    index_md = generate_index_md(results)
    (OUTPUT_DIR / "_index.md").write_text(index_md, encoding="utf-8")
    print(f"\n  {'INDEX':>7}  _index.md")

    # Summary
    keeps = sum(1 for r in results if r["verdict"] == "KEEP")
    tunes = sum(1 for r in results if r["verdict"] == "TUNE")
    discards = sum(1 for r in results if r["verdict"] == "DISCARD")
    total_pnl = sum(r["metrics"].net_pnl for r in results)

    print(f"\nDone! {len(results)} reviews + 1 index = {len(results) + 1} files")
    print(f"  KEEP: {keeps} | TUNE: {tunes} | DISCARD: {discards}")
    print(f"  Fleet PnL: ${total_pnl:+,.2f}")


if __name__ == "__main__":
    asyncio.run(main())
