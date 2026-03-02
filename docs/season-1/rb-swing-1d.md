# RB Swing Trader (1D) — Season 1 Review

> Agent: `rb-swing-1d` | ID: 48 | Archetype: swing | Timeframe: 1d | Engine: rule | Source: technical

## Verdict: KEEP
Positive PnL ($+152.91) with positive expectancy ($25.48/trade)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $+152.91 |
| Return | +1.5% |
| Total Equity | $8,198.20 |
| Trades | 6 (2W / 4L) |
| Win Rate | 33.3% |
| Avg Win | $143.18 |
| Avg Loss | -$33.36 |
| Win/Loss Ratio | 4.3:1 |
| Expectancy/Trade | $25.48 |
| Profit Factor | 2.15 |
| Total Fees | $8.43 (3% of gross) |
| Open Positions | 3 |

## Strategy Overview
Multi-day trend capture using EMA alignment. Enters when EMA50 > EMA200 (uptrend), score >= 0.55, RSI in neutral zone (40-55), Stochastic < 50 with bullish cross, ADX >= 20 (trending). SL 4%, TP 8% (2:1 ratio). Large position sizes (12-20%). Exits on RSI >= 70 or EMA200 breakdown.

## Strengths
- Strong win/loss ratio (4.3:1) — winners outsize losers
- Profit factor above 1.0 (2.15)
- Solid average winning trade ($143.18)
- Low fee impact (2.9% of gross profits)
- Healthy TP hit rate (33% of exits)

## Weaknesses
- Low win rate (33.3%) — most entries fail

## Trade Analysis
- **Best trade**: AAVEUSDT short +$157.95 (take_profit)
- **Worst trade**: PEPEUSDT short $-50.05 (stop_loss)
- **Exit breakdown**: 3 stop_loss / 2 take_profit / 1 agent_decision
- **Direction split**: 1 long (0%) / 5 short (40%)
- **Avg duration**: 47.5h

## Recommendations
**Status: Continue running.** Monitor these metrics going forward:

- Watch for win rate regression below 30%
- Track expectancy — flag if drops below $0/trade
- Current fee ratio (2.9%) is manageable but monitor
- 3 open position(s) — watch for concentration risk
