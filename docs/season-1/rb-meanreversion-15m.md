# RB Mean Reversion (15M) — Season 1 Review

> Agent: `rb-meanreversion-15m` | ID: 30 | Archetype: mean_reversion | Timeframe: 15m | Engine: rule | Source: technical

## Verdict: TUNE
Decent WR (55.4%) but negative expectancy ($-0.74/trade) — poor TP:SL or fee drag

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-123.76 |
| Return | -1.2% |
| Total Equity | $7,844.63 |
| Trades | 168 (93W / 75L) |
| Win Rate | 55.4% |
| Avg Win | $13.74 |
| Avg Loss | -$18.68 |
| Win/Loss Ratio | 0.7:1 |
| Expectancy/Trade | $-0.74 |
| Profit Factor | 0.91 |
| Total Fees | $150.69 (11% of gross) |
| Open Positions | 2 |

## Strategy Overview
Contrarian bounce trades at extremes. Enters long in uptrend (above EMA200) when RSI < 30 or BB %B < 0.05 with Stochastic confirmation (K < 20, K > D). SL 3%, TP 4% (1.33:1 ratio) - tight TP:SL requires high win rate to profit. Position size 10%. Exits when price reverts to mean (near EMA20).

## Strengths
- Above-average win rate (55.4%) suggests good entry timing
- Strong on longs (73% WR across 22 trades)
- Strong on shorts (53% WR across 146 trades)
- Low fee impact (11.1% of gross profits)

## Weaknesses
- Poor win/loss ratio (0.7:1) — winners don't compensate for losers
- Avg loss ($18.68) exceeds avg win ($13.74)
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable

## Trade Analysis
- **Best trade**: BERAUSDT short +$39.22 (take_profit)
- **Worst trade**: MEUSDT short $-31.25 (stop_loss)
- **Exit breakdown**: 46 stop_loss / 16 take_profit / 106 agent_decision
- **Direction split**: 22 long (73%) / 146 short (53%)
- **Avg duration**: 4.0h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Take Profit | 4% | 6% | Improve TP:SL from 1.3:1 to 2.0:1 |
