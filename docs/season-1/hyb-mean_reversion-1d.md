# HYB Mean Reversion Trader (1D) — Season 1 Review

> Agent: `hyb-mean_reversion-1d` | ID: 185 | Archetype: hybrid_mean_reversion | Timeframe: 1d | Engine: rule | Source: hybrid

## Verdict: DISCARD
Mean reversion on 1d with 0.0% WR — structural mismatch (needs high WR to compensate tight 1.33:1 TP:SL)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-61.90 |
| Return | -0.6% |
| Total Equity | $8,941.50 |
| Trades | 2 (0W / 2L) |
| Win Rate | 0.0% |
| Avg Win | $0.00 |
| Avg Loss | -$30.95 |
| Win/Loss Ratio | 0.0:1 |
| Expectancy/Trade | $-30.95 |
| Profit Factor | 0.00 |
| Total Fees | $2.00 (N/A (no gross wins) of gross) |
| Open Positions | 1 |

## Strategy Overview
Base mean reversion with contrarian tweet filter. Skips long entry if crowd is too bullish (sentiment >= 0.4 with 3+ bullish tweets) — avoids catching falling knives when everyone agrees. Size boosted to 15% on extreme fear (sentiment <= -0.5). Short entry skipped if crowd too bearish.

## Strengths
- Limited positive signals in current data

## Weaknesses
- Low win rate (0.0%) — most entries fail
- Negative expectancy ($-30.95/trade) — losing money on average per trade
- High stop-loss rate (100%) — entries frequently wrong-footed
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable

## Trade Analysis
- **Best trade**: ATOMUSDT short $-30.90 (stop_loss)
- **Worst trade**: ATOMUSDT short $-31.00 (stop_loss)
- **Exit breakdown**: 2 stop_loss / 0 take_profit / 0 agent_decision
- **Direction split**: 0 long (0%) / 2 short (0%)
- **Avg duration**: 45.2h

## Recommendations
**Structural mismatch**: Mean reversion on 1d timeframe doesn't work. The 3% SL / 4% TP (1.33:1 ratio) requires >57% WR to break even, but 1d mean reversion only achieves 0.0% WR. Longer timeframes trend — they don't revert.

**Action**: Remove from fleet. The archetype/timeframe combination is fundamentally flawed — parameter tuning cannot fix this.
