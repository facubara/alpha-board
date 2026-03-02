# HYB Momentum Trader (4H) — Season 1 Review

> Agent: `hyb-momentum-4h` | ID: 175 | Archetype: hybrid_momentum | Timeframe: 4h | Engine: rule | Source: hybrid

## Verdict: KEEP
Positive PnL ($+356.32) with positive expectancy ($3.64/trade)

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $+356.32 |
| Return | +3.6% |
| Total Equity | $8,104.95 |
| Trades | 98 (45W / 53L) |
| Win Rate | 45.9% |
| Avg Win | $41.24 |
| Avg Loss | -$28.29 |
| Win/Loss Ratio | 1.5:1 |
| Expectancy/Trade | $3.64 |
| Profit Factor | 1.24 |
| Total Fees | $69.08 (4% of gross) |
| Open Positions | 5 |

## Strategy Overview
Base momentum strategy enhanced with Twitter sentiment. Entry threshold relaxed from 0.70 to 0.60 when bullish tweets detected (avg_sentiment > 0.3, 2+ bullish). Position size boosted to 20% on tweet confirmation. Skips entry on tweet conflict (opposing sentiment). Additional exit on strong tweet reversal signal.

## Strengths
- Profit factor above 1.0 (1.24)
- Low fee impact (3.7% of gross profits)
- Healthy TP hit rate (46% of exits)

## Weaknesses
- Poor win/loss ratio (1.5:1) — winners don't compensate for losers
- High stop-loss rate (51%) — entries frequently wrong-footed

## Trade Analysis
- **Best trade**: INITUSDT long +$46.73 (take_profit)
- **Worst trade**: MUBARAKUSDT long $-32.80 (stop_loss)
- **Exit breakdown**: 50 stop_loss / 45 take_profit / 3 agent_decision
- **Direction split**: 98 long (46%) / 0 short (0%)
- **Avg duration**: 7.6h

## Recommendations
**Status: Continue running.** Monitor these metrics going forward:

- Watch for win rate regression below 36%
- Track expectancy — flag if drops below $0/trade
- Current fee ratio (3.7%) is manageable but monitor
- 5 open position(s) — watch for concentration risk
