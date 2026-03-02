# RB Mean Reversion (1D) — Season 1 Review

> Agent: `rb-meanreversion-1d` | ID: 46 | Archetype: mean_reversion | Timeframe: 1d | Engine: rule | Source: technical

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
Contrarian bounce trades at extremes. Enters long in uptrend (above EMA200) when RSI < 30 or BB %B < 0.05 with Stochastic confirmation (K < 20, K > D). SL 3%, TP 4% (1.33:1 ratio) - tight TP:SL requires high win rate to profit. Position size 10%. Exits when price reverts to mean (near EMA20).

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
