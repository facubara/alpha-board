# HYB Mean Reversion Trader (1W) — Season 1 Review

> Agent: `hyb-mean_reversion-1w` | ID: 193 | Archetype: hybrid_mean_reversion | Timeframe: 1w | Engine: rule | Source: hybrid

## Verdict: DISCARD
Mean reversion on 1w with 25.0% WR — structural mismatch (needs high WR to compensate tight 1.33:1 TP:SL)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-107.79 |
| Return | -1.1% |
| Total Equity | $9,884.22 |
| Trades | 8 (2W / 6L) |
| Win Rate | 25.0% |
| Avg Win | $39.08 |
| Avg Loss | -$30.99 |
| Win/Loss Ratio | 1.3:1 |
| Expectancy/Trade | $-13.47 |
| Profit Factor | 0.42 |
| Total Fees | $7.99 (10% of gross) |
| Open Positions | 1 |

## Strategy Overview
Base mean reversion with contrarian tweet filter. Skips long entry if crowd is too bullish (sentiment >= 0.4 with 3+ bullish tweets) — avoids catching falling knives when everyone agrees. Size boosted to 15% on extreme fear (sentiment <= -0.5). Short entry skipped if crowd too bearish.

## Strengths
- Low fee impact (10.0% of gross profits)

## Weaknesses
- Low win rate (25.0%) — most entries fail
- Poor win/loss ratio (1.3:1) — winners don't compensate for losers
- Negative expectancy ($-13.47/trade) — losing money on average per trade
- High stop-loss rate (75%) — entries frequently wrong-footed
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable
- Weak on longs (25% WR across 8 trades)

## Trade Analysis
- **Best trade**: BTCUSDT long +$39.15 (take_profit)
- **Worst trade**: BTCUSDT long $-31.24 (stop_loss)
- **Exit breakdown**: 6 stop_loss / 2 take_profit / 0 agent_decision
- **Direction split**: 8 long (25%) / 0 short (0%)
- **Avg duration**: 33.4h

## Recommendations
**Structural mismatch**: Mean reversion on 1w timeframe doesn't work. The 3% SL / 4% TP (1.33:1 ratio) requires >57% WR to break even, but 1w mean reversion only achieves 25.0% WR. Longer timeframes trend — they don't revert.

**Action**: Remove from fleet. The archetype/timeframe combination is fundamentally flawed — parameter tuning cannot fix this.
