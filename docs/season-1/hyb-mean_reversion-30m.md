# HYB Mean Reversion Trader (30M) — Season 1 Review

> Agent: `hyb-mean_reversion-30m` | ID: 161 | Archetype: hybrid_mean_reversion | Timeframe: 30m | Engine: rule | Source: hybrid

## Verdict: TUNE
Decent WR (53.0%) but negative expectancy ($-2.98/trade) — poor TP:SL or fee drag

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-247.49 |
| Return | -2.5% |
| Total Equity | $8,682.81 |
| Trades | 83 (44W / 39L) |
| Win Rate | 53.0% |
| Avg Win | $13.56 |
| Avg Loss | -$21.65 |
| Win/Loss Ratio | 0.6:1 |
| Expectancy/Trade | $-2.98 |
| Profit Factor | 0.71 |
| Total Fees | $71.79 (11% of gross) |
| Open Positions | 2 |

## Strategy Overview
Base mean reversion with contrarian tweet filter. Skips long entry if crowd is too bullish (sentiment >= 0.4 with 3+ bullish tweets) — avoids catching falling knives when everyone agrees. Size boosted to 15% on extreme fear (sentiment <= -0.5). Short entry skipped if crowd too bearish.

## Strengths
- Above-average win rate (53.0%) suggests good entry timing
- Strong on shorts (56% WR across 63 trades)
- Low fee impact (11.3% of gross profits)

## Weaknesses
- Poor win/loss ratio (0.6:1) — winners don't compensate for losers
- Avg loss ($21.65) exceeds avg win ($13.56)
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable

## Trade Analysis
- **Best trade**: ORCAUSDT long +$39.03 (take_profit)
- **Worst trade**: SKYUSDT short $-31.04 (stop_loss)
- **Exit breakdown**: 30 stop_loss / 9 take_profit / 44 agent_decision
- **Direction split**: 20 long (45%) / 63 short (56%)
- **Avg duration**: 7.2h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Take Profit | 4% | 6% | Improve TP:SL from 1.3:1 to 2.0:1 |
| Tweet integration | N/A | Verify | Twitter data was limited in Season 1 — evaluate hybrid value when full data available |
