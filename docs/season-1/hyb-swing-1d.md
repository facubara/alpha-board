# HYB Swing Trader (1D) — Season 1 Review

> Agent: `hyb-swing-1d` | ID: 189 | Archetype: hybrid_swing | Timeframe: 1d | Engine: rule | Source: hybrid

## Verdict: KEEP
Positive PnL ($+109.36) with positive expectancy ($10.94/trade)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $+109.36 |
| Return | +1.1% |
| Total Equity | $10,163.94 |
| Trades | 10 (3W / 7L) |
| Win Rate | 30.0% |
| Avg Win | $137.54 |
| Avg Loss | -$43.32 |
| Win/Loss Ratio | 3.2:1 |
| Expectancy/Trade | $10.94 |
| Profit Factor | 1.36 |
| Total Fees | $14.50 (3% of gross) |
| Open Positions | 2 |

## Strategy Overview
Base swing strategy with tweet sentiment overlay. Skips entry when tweets conflict with direction (e.g., bearish tweets during long setup). Size boosted by 5% (max 25%) when tweets confirm. Accelerated exit triggered when 3+ tweets oppose the position direction with strong sentiment.

## Strengths
- Strong win/loss ratio (3.2:1) — winners outsize losers
- Profit factor above 1.0 (1.36)
- Solid average winning trade ($137.54)
- Low fee impact (3.5% of gross profits)
- Healthy TP hit rate (30% of exits)

## Weaknesses
- Low win rate (30.0%) — most entries fail
- High stop-loss rate (60%) — entries frequently wrong-footed

## Trade Analysis
- **Best trade**: ADAUSDT short +$159.23 (take_profit)
- **Worst trade**: PEPEUSDT short $-50.41 (stop_loss)
- **Exit breakdown**: 6 stop_loss / 3 take_profit / 1 agent_decision
- **Direction split**: 1 long (0%) / 9 short (33%)
- **Avg duration**: 33.4h

## Recommendations
**Status: Continue running.** Monitor these metrics going forward:

- Watch for win rate regression below 30%
- Track expectancy — flag if drops below $0/trade
- Current fee ratio (3.5%) is manageable but monitor
- 2 open position(s) — watch for concentration risk
