# RB Mean Reversion (1H) — Season 1 Review

> Agent: `rb-meanreversion-1h` | ID: 38 | Archetype: mean_reversion | Timeframe: 1h | Engine: rule | Source: technical

## Verdict: TUNE
Negative PnL ($-402.70) but parameters may be tunable

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-402.70 |
| Return | -4.0% |
| Total Equity | $9,529.45 |
| Trades | 69 (29W / 40L) |
| Win Rate | 42.0% |
| Avg Win | $28.12 |
| Avg Loss | -$30.46 |
| Win/Loss Ratio | 0.9:1 |
| Expectancy/Trade | $-5.84 |
| Profit Factor | 0.67 |
| Total Fees | $67.94 (8% of gross) |
| Open Positions | 0 |

## Strategy Overview
Contrarian bounce trades at extremes. Enters long in uptrend (above EMA200) when RSI < 30 or BB %B < 0.05 with Stochastic confirmation (K < 20, K > D). SL 3%, TP 4% (1.33:1 ratio) - tight TP:SL requires high win rate to profit. Position size 10%. Exits when price reverts to mean (near EMA20).

## Strengths
- Low fee impact (8.0% of gross profits)

## Weaknesses
- Poor win/loss ratio (0.9:1) — winners don't compensate for losers
- Negative expectancy ($-5.84/trade) — losing money on average per trade
- High stop-loss rate (58%) — entries frequently wrong-footed
- Avg loss ($30.46) exceeds avg win ($28.12)
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable

## Trade Analysis
- **Best trade**: XVSUSDT short +$39.00 (take_profit)
- **Worst trade**: EULUSDT short $-31.12 (stop_loss)
- **Exit breakdown**: 40 stop_loss / 16 take_profit / 13 agent_decision
- **Direction split**: 19 long (47%) / 50 short (40%)
- **Avg duration**: 6.4h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Take Profit | 4% | 6% | Improve TP:SL from 1.3:1 to 2.0:1 |
