# RB Breakout Hunter (1H) — Season 1 Review

> Agent: `rb-breakout-1h` | ID: 39 | Archetype: breakout | Timeframe: 1h | Engine: rule | Source: technical

## Verdict: KEEP
Positive PnL ($+60.08) with positive expectancy ($0.74/trade)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $+60.08 |
| Return | +0.6% |
| Total Equity | $9,192.65 |
| Trades | 81 (26W / 55L) |
| Win Rate | 32.1% |
| Avg Win | $11.90 |
| Avg Loss | -$4.53 |
| Win/Loss Ratio | 2.6:1 |
| Expectancy/Trade | $0.74 |
| Profit Factor | 1.24 |
| Total Fees | $60.51 (18% of gross) |
| Open Positions | 2 |

## Strategy Overview
Volatility squeeze breakouts. Enters when BB bandwidth < 5 (squeeze) and price breaks above/below bands with volume confirmation (OBV slope > 2.0). ADX < 25 confirms emerging (not established) trend. SL 5%, TP 10% (2:1 ratio). Position size 8%. Exits when price returns inside Bollinger Bands.

## Strengths
- Strong win/loss ratio (2.6:1) — winners outsize losers
- Profit factor above 1.0 (1.24)
- Low fee impact (18.4% of gross profits)

## Weaknesses
- Low win rate (32.1%) — most entries fail
- Weak on shorts (23% WR across 13 trades)

## Trade Analysis
- **Best trade**: ZECUSDT long +$72.72 (take_profit)
- **Worst trade**: SENTUSDT long $-17.22 (agent_decision)
- **Exit breakdown**: 0 stop_loss / 1 take_profit / 80 agent_decision
- **Direction split**: 68 long (34%) / 13 short (23%)
- **Avg duration**: 1.8h

## Recommendations
**Status: Continue running.** Monitor these metrics going forward:

- Watch for win rate regression below 30%
- Track expectancy — flag if drops below $0/trade
- Current fee ratio (18.4%) is manageable but monitor
- 2 open position(s) — watch for concentration risk
