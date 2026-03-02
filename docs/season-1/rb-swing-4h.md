# RB Swing Trader (4H) — Season 1 Review

> Agent: `rb-swing-4h` | ID: 44 | Archetype: swing | Timeframe: 4h | Engine: rule | Source: technical

## Verdict: KEEP
Positive PnL ($+199.79) with positive expectancy ($24.97/trade)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $+199.79 |
| Return | +2.0% |
| Total Equity | $10,184.03 |
| Trades | 8 (4W / 4L) |
| Win Rate | 50.0% |
| Avg Win | $103.62 |
| Avg Loss | -$53.67 |
| Win/Loss Ratio | 1.9:1 |
| Expectancy/Trade | $24.97 |
| Profit Factor | 1.93 |
| Total Fees | $12.52 (3% of gross) |
| Open Positions | 2 |

## Strategy Overview
Multi-day trend capture using EMA alignment. Enters when EMA50 > EMA200 (uptrend), score >= 0.55, RSI in neutral zone (40-55), Stochastic < 50 with bullish cross, ADX >= 20 (trending). SL 4%, TP 8% (2:1 ratio). Large position sizes (12-20%). Exits on RSI >= 70 or EMA200 breakdown.

## Strengths
- Above-average win rate (50.0%) suggests good entry timing
- Profit factor above 1.0 (1.93)
- Solid average winning trade ($103.62)
- Strong on longs (50% WR across 6 trades)
- Low fee impact (3.0% of gross profits)
- Healthy TP hit rate (38% of exits)

## Weaknesses
- No critical weaknesses identified (small sample size)

## Trade Analysis
- **Best trade**: KITEUSDT long +$159.48 (take_profit)
- **Worst trade**: UNIUSDT short $-75.33 (stop_loss)
- **Exit breakdown**: 4 stop_loss / 3 take_profit / 1 agent_decision
- **Direction split**: 6 long (50%) / 2 short (50%)
- **Avg duration**: 42.0h

## Recommendations
**Status: Continue running.** Monitor these metrics going forward:

- Watch for win rate regression below 40%
- Track expectancy — flag if drops below $0/trade
- Current fee ratio (3.0%) is manageable but monitor
- 2 open position(s) — watch for concentration risk
