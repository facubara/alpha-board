# HYB Breakout Trader (4H) — Season 1 Review

> Agent: `hyb-breakout-4h` | ID: 179 | Archetype: hybrid_breakout | Timeframe: 4h | Engine: rule | Source: hybrid

## Verdict: KEEP
Positive PnL ($+5.28) with positive expectancy ($0.66/trade)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $+5.28 |
| Return | +0.1% |
| Total Equity | $9,198.97 |
| Trades | 8 (2W / 6L) |
| Win Rate | 25.0% |
| Avg Win | $12.48 |
| Avg Loss | -$3.28 |
| Win/Loss Ratio | 3.8:1 |
| Expectancy/Trade | $0.66 |
| Profit Factor | 1.27 |
| Total Fees | $6.07 (23% of gross) |
| Open Positions | 1 |

## Strategy Overview
Base breakout with Twitter mention boost. Position size increased from 8% to 12% when the breakout symbol appears in trending Twitter mentions. Size reduced by 50% on sentiment conflict (bearish tweets during long breakout or vice versa).

## Strengths
- Strong win/loss ratio (3.8:1) — winners outsize losers
- Profit factor above 1.0 (1.27)

## Weaknesses
- Low win rate (25.0%) — most entries fail
- Weak on shorts (20% WR across 5 trades)

## Trade Analysis
- **Best trade**: PAXGUSDT long +$22.30 (agent_decision)
- **Worst trade**: ATUSDT long $-13.63 (agent_decision)
- **Exit breakdown**: 0 stop_loss / 0 take_profit / 8 agent_decision
- **Direction split**: 3 long (33%) / 5 short (20%)
- **Avg duration**: 5.8h

## Recommendations
**Status: Continue running.** Monitor these metrics going forward:

- Watch for win rate regression below 30%
- Track expectancy — flag if drops below $0/trade
- Current fee ratio (23.0%) is manageable but monitor
- 1 open position(s) — watch for concentration risk
