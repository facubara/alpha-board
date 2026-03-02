# HYB Mean Reversion Trader (4H) — Season 1 Review

> Agent: `hyb-mean_reversion-4h` | ID: 177 | Archetype: hybrid_mean_reversion | Timeframe: 4h | Engine: rule | Source: hybrid

## Verdict: DISCARD
Mean reversion on 4h with 28.6% WR — structural mismatch (needs high WR to compensate tight 1.33:1 TP:SL)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-124.39 |
| Return | -1.2% |
| Total Equity | $8,865.10 |
| Trades | 14 (4W / 10L) |
| Win Rate | 28.6% |
| Avg Win | $34.80 |
| Avg Loss | -$26.36 |
| Win/Loss Ratio | 1.3:1 |
| Expectancy/Trade | $-8.88 |
| Profit Factor | 0.53 |
| Total Fees | $12.72 (9% of gross) |
| Open Positions | 1 |

## Strategy Overview
Base mean reversion with contrarian tweet filter. Skips long entry if crowd is too bullish (sentiment >= 0.4 with 3+ bullish tweets) — avoids catching falling knives when everyone agrees. Size boosted to 15% on extreme fear (sentiment <= -0.5). Short entry skipped if crowd too bearish.

## Strengths
- Low fee impact (8.9% of gross profits)

## Weaknesses
- Low win rate (28.6%) — most entries fail
- Poor win/loss ratio (1.3:1) — winners don't compensate for losers
- Negative expectancy ($-8.88/trade) — losing money on average per trade
- High stop-loss rate (64%) — entries frequently wrong-footed
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable
- Weak on shorts (27% WR across 11 trades)

## Trade Analysis
- **Best trade**: ETCUSDT short +$34.95 (take_profit)
- **Worst trade**: WLFIUSDT short $-31.00 (stop_loss)
- **Exit breakdown**: 9 stop_loss / 4 take_profit / 1 agent_decision
- **Direction split**: 3 long (33%) / 11 short (27%)
- **Avg duration**: 10.6h

## Recommendations
**Structural mismatch**: Mean reversion on 4h timeframe doesn't work. The 3% SL / 4% TP (1.33:1 ratio) requires >57% WR to break even, but 4h mean reversion only achieves 28.6% WR. Longer timeframes trend — they don't revert.

**Action**: Remove from fleet. The archetype/timeframe combination is fundamentally flawed — parameter tuning cannot fix this.
