# HYB Swing Trader (4H) — Season 1 Review

> Agent: `hyb-swing-4h` | ID: 181 | Archetype: hybrid_swing | Timeframe: 4h | Engine: rule | Source: hybrid

## Verdict: KEEP
Positive PnL ($+65.76) with positive expectancy ($10.96/trade)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $+65.76 |
| Return | +0.7% |
| Total Equity | $10,055.10 |
| Trades | 6 (3W / 3L) |
| Win Rate | 50.0% |
| Avg Win | $63.48 |
| Avg Loss | -$41.56 |
| Win/Loss Ratio | 1.5:1 |
| Expectancy/Trade | $10.96 |
| Profit Factor | 1.53 |
| Total Fees | $7.45 (4% of gross) |
| Open Positions | 2 |

## Strategy Overview
Base swing strategy with tweet sentiment overlay. Skips entry when tweets conflict with direction (e.g., bearish tweets during long setup). Size boosted by 5% (max 25%) when tweets confirm. Accelerated exit triggered when 3+ tweets oppose the position direction with strong sentiment.

## Strengths
- Above-average win rate (50.0%) suggests good entry timing
- Profit factor above 1.0 (1.53)
- Solid average winning trade ($63.48)
- Low fee impact (3.8% of gross profits)
- Healthy TP hit rate (33% of exits)

## Weaknesses
- No critical weaknesses identified (small sample size)

## Trade Analysis
- **Best trade**: COWUSDT long +$94.87 (take_profit)
- **Worst trade**: BANANAS31USDT long $-49.20 (stop_loss)
- **Exit breakdown**: 3 stop_loss / 2 take_profit / 1 agent_decision
- **Direction split**: 5 long (40%) / 1 short (100%)
- **Avg duration**: 54.8h

## Recommendations
**Status: Continue running.** Monitor these metrics going forward:

- Watch for win rate regression below 40%
- Track expectancy — flag if drops below $0/trade
- Current fee ratio (3.8%) is manageable but monitor
- 2 open position(s) — watch for concentration risk
