# RB Mean Reversion (30M) — Season 1 Review

> Agent: `rb-meanreversion-30m` | ID: 34 | Archetype: mean_reversion | Timeframe: 30m | Engine: rule | Source: technical

## Verdict: TUNE
Decent WR (51.6%) but negative expectancy ($-2.96/trade) — poor TP:SL or fee drag

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-269.13 |
| Return | -2.7% |
| Total Equity | $8,656.71 |
| Trades | 91 (47W / 44L) |
| Win Rate | 51.6% |
| Avg Win | $14.47 |
| Avg Loss | -$21.57 |
| Win/Loss Ratio | 0.7:1 |
| Expectancy/Trade | $-2.96 |
| Profit Factor | 0.72 |
| Total Fees | $79.62 (11% of gross) |
| Open Positions | 2 |

## Strategy Overview
Contrarian bounce trades at extremes. Enters long in uptrend (above EMA200) when RSI < 30 or BB %B < 0.05 with Stochastic confirmation (K < 20, K > D). SL 3%, TP 4% (1.33:1 ratio) - tight TP:SL requires high win rate to profit. Position size 10%. Exits when price reverts to mean (near EMA20).

## Strengths
- Above-average win rate (51.6%) suggests good entry timing
- Strong on shorts (54% WR across 71 trades)
- Low fee impact (11.0% of gross profits)

## Weaknesses
- Poor win/loss ratio (0.7:1) — winners don't compensate for losers
- Avg loss ($21.57) exceeds avg win ($14.47)
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable

## Trade Analysis
- **Best trade**: DASHUSDT short +$39.00 (take_profit)
- **Worst trade**: SOLUSDT short $-31.13 (stop_loss)
- **Exit breakdown**: 33 stop_loss / 11 take_profit / 47 agent_decision
- **Direction split**: 20 long (45%) / 71 short (54%)
- **Avg duration**: 7.3h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Take Profit | 4% | 6% | Improve TP:SL from 1.3:1 to 2.0:1 |
