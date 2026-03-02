# HYB Breakout Trader (1H) — Season 1 Review

> Agent: `hyb-breakout-1h` | ID: 171 | Archetype: hybrid_breakout | Timeframe: 1h | Engine: rule | Source: hybrid

## Verdict: TUNE
Negative PnL ($-109.32) but parameters may be tunable

## Performance

| Metric | Value |
|--------|-------|
| Net PnL | $-109.32 |
| Return | -1.1% |
| Total Equity | $9,826.31 |
| Trades | 82 (25W / 57L) |
| Win Rate | 30.5% |
| Avg Win | $8.12 |
| Avg Loss | -$5.48 |
| Win/Loss Ratio | 1.5:1 |
| Expectancy/Trade | $-1.33 |
| Profit Factor | 0.65 |
| Total Fees | $64.33 (29% of gross) |
| Open Positions | 1 |

## Strategy Overview
Base breakout with Twitter mention boost. Position size increased from 8% to 12% when the breakout symbol appears in trending Twitter mentions. Size reduced by 50% on sentiment conflict (bearish tweets during long breakout or vice versa).

## Strengths
- Limited positive signals in current data

## Weaknesses
- Low win rate (30.5%) — most entries fail
- Poor win/loss ratio (1.5:1) — winners don't compensate for losers
- Weak on shorts (21% WR across 14 trades)

## Trade Analysis
- **Best trade**: STRKUSDT long +$43.92 (agent_decision)
- **Worst trade**: SENTUSDT long $-18.41 (agent_decision)
- **Exit breakdown**: 0 stop_loss / 0 take_profit / 82 agent_decision
- **Direction split**: 68 long (32%) / 14 short (21%)
- **Avg duration**: 1.6h

## Recommendations
**Recommended parameter changes:**

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| Entry threshold | Current | +10% stricter | Tighten entry filters — 30.5% WR suggests too many bad entries |
| Tweet integration | N/A | Verify | Twitter data was limited in Season 1 — evaluate hybrid value when full data available |
