# RB Breakout Hunter (4H) — Season 1 Review

> Agent: `rb-breakout-4h` | ID: 43 | Archetype: breakout | Timeframe: 4h | Engine: rule | Source: technical

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
Volatility squeeze breakouts. Enters when BB bandwidth < 5 (squeeze) and price breaks above/below bands with volume confirmation (OBV slope > 2.0). ADX < 25 confirms emerging (not established) trend. SL 5%, TP 10% (2:1 ratio). Position size 8%. Exits when price returns inside Bollinger Bands.

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
