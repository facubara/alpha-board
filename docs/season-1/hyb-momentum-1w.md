# HYB Momentum Trader (1W) — Season 1 Review

> Agent: `hyb-momentum-1w` | ID: 191 | Archetype: hybrid_momentum | Timeframe: 1w | Engine: rule | Source: hybrid

## Verdict: TUNE
Too few trades (3) for statistical significance — needs more data

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-18.61 |
| Return | -0.2% |
| Total Equity | $9,978.99 |
| Trades | 3 (1W / 2L) |
| Win Rate | 33.3% |
| Avg Win | $46.88 |
| Avg Loss | -$32.74 |
| Win/Loss Ratio | 1.4:1 |
| Expectancy/Trade | $-6.20 |
| Profit Factor | 0.72 |
| Total Fees | $2.39 (5% of gross) |
| Open Positions | 0 |

## Strategy Overview
Base momentum strategy enhanced with Twitter sentiment. Entry threshold relaxed from 0.70 to 0.60 when bullish tweets detected (avg_sentiment > 0.3, 2+ bullish). Position size boosted to 20% on tweet confirmation. Skips entry on tweet conflict (opposing sentiment). Additional exit on strong tweet reversal signal.

## Strengths
- Low fee impact (5.0% of gross profits)
- Healthy TP hit rate (33% of exits)

## Weaknesses
- Low win rate (33.3%) — most entries fail
- Poor win/loss ratio (1.4:1) — winners don't compensate for losers
- Negative expectancy ($-6.20/trade) — losing money on average per trade
- High stop-loss rate (67%) — entries frequently wrong-footed

## Trade Analysis
- **Best trade**: DCRUSDT long +$46.88 (take_profit)
- **Worst trade**: DCRUSDT long $-32.80 (stop_loss)
- **Exit breakdown**: 2 stop_loss / 1 take_profit / 0 agent_decision
- **Direction split**: 3 long (33%) / 0 short (0%)
- **Avg duration**: 40.4h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Take Profit | 6% | 8% | Improve TP:SL from 1.5:1 to 2.0:1 |
| Entry threshold | Current | +10% stricter | Tighten entry filters — 33.3% WR suggests too many bad entries |
| Entry threshold | Current | -10% looser | Only 3 trades in season — relax to generate more signals for evaluation |
| Stop Loss | 4% | 3.0% | Tighten SL — 2/3 trades hit stop (67%) |
| Tweet integration | N/A | Verify | Twitter data was limited in Season 1 — evaluate hybrid value when full data available |
