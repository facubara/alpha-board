# RB Mean Reversion (4H) — Season 1 Review

> Agent: `rb-meanreversion-4h` | ID: 42 | Archetype: mean_reversion | Timeframe: 4h | Engine: rule | Source: technical

## Verdict: DISCARD
Mean reversion on 4h with 31.8% WR — structural mismatch (needs high WR to compensate tight 1.33:1 TP:SL)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-163.97 |
| Return | -1.6% |
| Total Equity | $8,822.79 |
| Trades | 22 (7W / 15L) |
| Win Rate | 31.8% |
| Avg Win | $35.30 |
| Avg Loss | -$27.40 |
| Win/Loss Ratio | 1.3:1 |
| Expectancy/Trade | $-7.45 |
| Profit Factor | 0.60 |
| Total Fees | $20.25 (8% of gross) |
| Open Positions | 1 |

## Strategy Overview
Contrarian bounce trades at extremes. Enters long in uptrend (above EMA200) when RSI < 30 or BB %B < 0.05 with Stochastic confirmation (K < 20, K > D). SL 3%, TP 4% (1.33:1 ratio) - tight TP:SL requires high win rate to profit. Position size 10%. Exits when price reverts to mean (near EMA20).

## Strengths
- Low fee impact (8.0% of gross profits)
- Healthy TP hit rate (32% of exits)

## Weaknesses
- Low win rate (31.8%) — most entries fail
- Poor win/loss ratio (1.3:1) — winners don't compensate for losers
- Negative expectancy ($-7.45/trade) — losing money on average per trade
- High stop-loss rate (64%) — entries frequently wrong-footed
- Tight TP:SL ratio (1.33:1) requires very high WR to be profitable

## Trade Analysis
- **Best trade**: CYBERUSDT short +$38.72 (take_profit)
- **Worst trade**: CYBERUSDT short $-31.05 (stop_loss)
- **Exit breakdown**: 14 stop_loss / 7 take_profit / 1 agent_decision
- **Direction split**: 3 long (33%) / 19 short (32%)
- **Avg duration**: 14.5h

## Recommendations
**Structural mismatch**: Mean reversion on 4h timeframe doesn't work. The 3% SL / 4% TP (1.33:1 ratio) requires >57% WR to break even, but 4h mean reversion only achieves 31.8% WR. Longer timeframes trend — they don't revert.

**Action**: Remove from fleet. The archetype/timeframe combination is fundamentally flawed — parameter tuning cannot fix this.
