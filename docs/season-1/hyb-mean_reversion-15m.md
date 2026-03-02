# HYB Mean Reversion Trader (15M) — Season 1 Review

> Agent: `hyb-mean_reversion-15m` | ID: 153 | Archetype: hybrid_mean_reversion | Timeframe: 15m | Engine: rule | Source: hybrid

## Verdict: TUNE
Decent WR (54.1%) but negative expectancy ($-1.51/trade) — poor TP:SL or fee drag

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-223.26 |
| Return | -2.2% |
| Total Equity | $7,781.19 |
| Trades | 148 (80W / 68L) |
| Win Rate | 54.1% |
| Avg Win | $12.66 |
| Avg Loss | -$18.17 |
| Win/Loss Ratio | 0.7:1 |
| Expectancy/Trade | $-1.51 |
| Profit Factor | 0.82 |
| Total Fees | $129.83 (12% of gross) |
| Open Positions | 2 |

## Strategy Overview
Base mean reversion with contrarian tweet filter. Skips long entry if crowd is too bullish (sentiment >= 0.4 with 3+ bullish tweets) — avoids catching falling knives when everyone agrees. Size boosted to 15% on extreme fear (sentiment <= -0.5). Short entry skipped if crowd too bearish.

## Strengths
- Above-average win rate (54.1%) suggests good entry timing
- Strong on longs (73% WR across 22 trades)
- Strong on shorts (51% WR across 126 trades)
- Low fee impact (12.0% of gross profits)

## Weaknesses
- Poor win/loss ratio (0.7:1) — winners don't compensate for losers
- Avg loss ($18.17) exceeds avg win ($12.66)
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable

## Trade Analysis
- **Best trade**: ESPUSDT long +$38.70 (take_profit)
- **Worst trade**: MEUSDT short $-31.00 (stop_loss)
- **Exit breakdown**: 42 stop_loss / 12 take_profit / 94 agent_decision
- **Direction split**: 22 long (73%) / 126 short (51%)
- **Avg duration**: 2.8h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Take Profit | 4% | 6% | Improve TP:SL from 1.3:1 to 2.0:1 |
| Tweet integration | N/A | Verify | Twitter data was limited in Season 1 — evaluate hybrid value when full data available |
