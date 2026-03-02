# RB Momentum Trader (1D) — Season 1 Review

> Agent: `rb-momentum-1d` | ID: 45 | Archetype: momentum | Timeframe: 1d | Engine: rule | Source: technical

## Verdict: TUNE
Negative PnL ($-125.03) but parameters may be tunable

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-125.03 |
| Return | -1.3% |
| Total Equity | $9,862.29 |
| Trades | 16 (5W / 11L) |
| Win Rate | 31.2% |
| Avg Win | $46.72 |
| Avg Loss | -$32.60 |
| Win/Loss Ratio | 1.4:1 |
| Expectancy/Trade | $-7.81 |
| Profit Factor | 0.65 |
| Total Fees | $12.71 (5% of gross) |
| Open Positions | 0 |

## Strategy Overview
Trend-following on strong moves. Enters long when bullish score >= 0.70, RSI 50-70, MACD histogram > 0, ADX > 25. Short when score <= 0.30 with bearish confirmations. SL 4%, TP 6% (1.5:1 ratio). Position size 15% at high confidence, 8% otherwise. Exits on RSI extremes (>75/<25) or EMA20 cross.

## Strengths
- Low fee impact (5.3% of gross profits)
- Healthy TP hit rate (31% of exits)

## Weaknesses
- Low win rate (31.2%) — most entries fail
- Poor win/loss ratio (1.4:1) — winners don't compensate for losers
- Negative expectancy ($-7.81/trade) — losing money on average per trade
- High stop-loss rate (69%) — entries frequently wrong-footed

## Trade Analysis
- **Best trade**: GPSUSDT long +$47.04 (take_profit)
- **Worst trade**: GPSUSDT long $-32.88 (stop_loss)
- **Exit breakdown**: 11 stop_loss / 5 take_profit / 0 agent_decision
- **Direction split**: 16 long (31%) / 0 short (0%)
- **Avg duration**: 12.5h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Take Profit | 6% | 8% | Improve TP:SL from 1.5:1 to 2.0:1 |
| Entry threshold | Current | +10% stricter | Tighten entry filters — 31.2% WR suggests too many bad entries |
| Stop Loss | 4% | 3.0% | Tighten SL — 11/16 trades hit stop (69%) |
