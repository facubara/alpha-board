# RB Mean Reversion (1W) — Season 1 Review

> Agent: `rb-meanreversion-1w` | ID: 50 | Archetype: mean_reversion | Timeframe: 1w | Engine: rule | Source: technical

## Verdict: TUNE
Near breakeven — fixable with parameter tuning

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-30.42 |
| Return | -0.3% |
| Total Equity | $9,959.54 |
| Trades | 10 (4W / 6L) |
| Win Rate | 40.0% |
| Avg Win | $39.23 |
| Avg Loss | -$31.22 |
| Win/Loss Ratio | 1.3:1 |
| Expectancy/Trade | $-3.04 |
| Profit Factor | 0.84 |
| Total Fees | $10.07 (6% of gross) |
| Open Positions | 1 |

## Strategy Overview
Contrarian bounce trades at extremes. Enters long in uptrend (above EMA200) when RSI < 30 or BB %B < 0.05 with Stochastic confirmation (K < 20, K > D). SL 3%, TP 4% (1.33:1 ratio) - tight TP:SL requires high win rate to profit. Position size 10%. Exits when price reverts to mean (near EMA20).

## Strengths
- Low fee impact (6.3% of gross profits)
- Healthy TP hit rate (40% of exits)

## Weaknesses
- Poor win/loss ratio (1.3:1) — winners don't compensate for losers
- High stop-loss rate (60%) — entries frequently wrong-footed
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable

## Trade Analysis
- **Best trade**: BTCUSDT long +$39.45 (take_profit)
- **Worst trade**: BTCUSDT long $-31.47 (stop_loss)
- **Exit breakdown**: 6 stop_loss / 4 take_profit / 0 agent_decision
- **Direction split**: 10 long (40%) / 0 short (0%)
- **Avg duration**: 36.4h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Take Profit | 4% | 6% | Improve TP:SL from 1.3:1 to 2.0:1 |
