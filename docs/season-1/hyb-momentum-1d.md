# HYB Momentum Trader (1D) — Season 1 Review

> Agent: `hyb-momentum-1d` | ID: 183 | Archetype: hybrid_momentum | Timeframe: 1d | Engine: rule | Source: hybrid

## Verdict: KEEP
Positive PnL ($+14.25) with positive expectancy ($7.12/trade)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $+14.25 |
| Return | +0.1% |
| Total Equity | $10,012.64 |
| Trades | 2 (1W / 1L) |
| Win Rate | 50.0% |
| Avg Win | $47.20 |
| Avg Loss | -$32.95 |
| Win/Loss Ratio | 1.4:1 |
| Expectancy/Trade | $7.12 |
| Profit Factor | 1.43 |
| Total Fees | $1.60 (3% of gross) |
| Open Positions | 0 |

## Strategy Overview
Base momentum strategy enhanced with Twitter sentiment. Entry threshold relaxed from 0.70 to 0.60 when bullish tweets detected (avg_sentiment > 0.3, 2+ bullish). Position size boosted to 20% on tweet confirmation. Skips entry on tweet conflict (opposing sentiment). Additional exit on strong tweet reversal signal.

## Strengths
- Above-average win rate (50.0%) suggests good entry timing
- Profit factor above 1.0 (1.43)
- Low fee impact (3.3% of gross profits)
- Healthy TP hit rate (50% of exits)

## Weaknesses
- Poor win/loss ratio (1.4:1) — winners don't compensate for losers

## Trade Analysis
- **Best trade**: ATMUSDT long +$47.20 (take_profit)
- **Worst trade**: GPSUSDT long $-32.95 (stop_loss)
- **Exit breakdown**: 1 stop_loss / 1 take_profit / 0 agent_decision
- **Direction split**: 2 long (50%) / 0 short (0%)
- **Avg duration**: 25.2h

## Recommendations
**Status: Continue running.** Monitor these metrics going forward:

- Watch for win rate regression below 40%
- Track expectancy — flag if drops below $0/trade
- Current fee ratio (3.3%) is manageable but monitor
