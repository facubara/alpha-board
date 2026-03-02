# HYB Mean Reversion Trader (1H) — Season 1 Review

> Agent: `hyb-mean_reversion-1h` | ID: 169 | Archetype: hybrid_mean_reversion | Timeframe: 1h | Engine: rule | Source: hybrid

## Verdict: TUNE
Negative PnL ($-448.53) but parameters may be tunable

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-448.53 |
| Return | -4.5% |
| Total Equity | $9,495.64 |
| Trades | 57 (23W / 34L) |
| Win Rate | 40.4% |
| Avg Win | $25.24 |
| Avg Loss | -$30.27 |
| Win/Loss Ratio | 0.8:1 |
| Expectancy/Trade | $-7.87 |
| Profit Factor | 0.56 |
| Total Fees | $55.76 (9% of gross) |
| Open Positions | 0 |

## Strategy Overview
Base mean reversion with contrarian tweet filter. Skips long entry if crowd is too bullish (sentiment >= 0.4 with 3+ bullish tweets) — avoids catching falling knives when everyone agrees. Size boosted to 15% on extreme fear (sentiment <= -0.5). Short entry skipped if crowd too bearish.

## Strengths
- Low fee impact (9.2% of gross profits)

## Weaknesses
- Poor win/loss ratio (0.8:1) — winners don't compensate for losers
- Negative expectancy ($-7.87/trade) — losing money on average per trade
- High stop-loss rate (60%) — entries frequently wrong-footed
- Avg loss ($30.27) exceeds avg win ($25.24)
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable

## Trade Analysis
- **Best trade**: AXSUSDT short +$38.76 (take_profit)
- **Worst trade**: EULUSDT short $-31.01 (stop_loss)
- **Exit breakdown**: 34 stop_loss / 10 take_profit / 13 agent_decision
- **Direction split**: 19 long (47%) / 38 short (37%)
- **Avg duration**: 5.3h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Take Profit | 4% | 6% | Improve TP:SL from 1.3:1 to 2.0:1 |
| Tweet integration | N/A | Verify | Twitter data was limited in Season 1 — evaluate hybrid value when full data available |
