# RB Momentum Trader (1W) — Season 1 Review

> Agent: `rb-momentum-1w` | ID: 49 | Archetype: momentum | Timeframe: 1w | Engine: rule | Source: technical

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
Trend-following on strong moves. Enters long when bullish score >= 0.70, RSI 50-70, MACD histogram > 0, ADX > 25. Short when score <= 0.30 with bearish confirmations. SL 4%, TP 6% (1.5:1 ratio). Position size 15% at high confidence, 8% otherwise. Exits on RSI extremes (>75/<25) or EMA20 cross.

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
