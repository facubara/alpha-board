# Active Rule Agent Performance Report

> Generated: 2026-03-01 | Based on realized PnL only (open positions excluded)
> 26 agents with trades analyzed | 33 agents with zero trades excluded (all tweet-based + dormant)

---

## Executive Summary

- **Total Net P&L: -$2,920** across 1,106 trades at 45.2% win rate
- **Core problem:** Win rate is decent but **average loss >> average win** — poor risk/reward ratio
- **Fees consume 200% of gross PnL** on short-timeframe agents (15m/30m)
- **Only 4H timeframe is profitable** (+$552 net)
- **Mean reversion is the biggest loser** (-$3,500 net across all variants)
- **Swing and momentum are the only profitable archetypes**

---

## Per-Agent Reports

### 1. RB Momentum Trader (4H) — BEST PERFORMER

| Metric | Value |
|--------|-------|
| Net PnL | **+$488.09** |
| Trades | 118 (56W / 62L) |
| Win Rate | 47.5% |
| Avg/Trade | +$4.14 |
| Fees | $179.44 (27% of gross) |
| Drawdown | 16.9% |
| Current | SL: 4%, TP: 6%, Size: 8-15% |

**Diagnosis:** Best agent by far. Positive expectancy. Decent WR with acceptable fee ratio. Drawdown at 16.9% is the only concern — driven by 6 concurrent open positions.

**Recommendations:**
- **Tighten max concurrent positions to 4** (from implicit ~6). Six positions at 8-15% each = 48-90% capital deployed. Too much concentration risk.
- **Widen TP to 8%** (from 6%). The 4H timeframe gives enough room. Current 1.5:1 reward:risk (6%:4%) is thin — 2:1 (8%:4%) would improve avg win.
- **Keep SL at 4%.** It's working — losses are contained.
- **Consider trailing stop:** After +3% gain, move SL to breakeven. Lets winners run without giving back gains.

---

### 2. HYB Momentum Trader (4H)

| Metric | Value |
|--------|-------|
| Net PnL | **+$159.59** |
| Trades | 93 (42W / 51L) |
| Win Rate | 45.2% |
| Avg/Trade | +$1.72 |
| Fees | $135.86 (46% of gross) |
| Drawdown | 19.6% |
| Current | SL: 4%, TP: 6%, Size: 8-15% (20% boosted) |

**Diagnosis:** Profitable but weaker than pure technical momentum. Tweet boost sizes positions at 20% — this increases fees and loss magnitude without proportionally increasing wins.

**Recommendations:**
- **Cap boosted position size at 12%** (from 20%). The tweet boost is adding size without adding edge — 20% positions amplify losses.
- **Widen TP to 8%** (match pure momentum recommendation).
- **Raise tweet sentiment threshold for boost to 0.5** (from 0.3). Only boost on strong conviction signals.
- **Reduce max concurrent to 4.** Currently holding 6 positions — same overcrowding issue.

---

### 3. RB Swing Trader (4H)

| Metric | Value |
|--------|-------|
| Net PnL | **+$170.67** |
| Trades | 8 (4W / 4L) |
| Win Rate | 50% |
| Avg/Trade | +$21.33 |
| Fees | $29.12 (15% of gross) |
| Drawdown | 0% |
| Current | SL: 4%, TP: 8%, Size: 12-20% |

**Diagnosis:** Excellent avg per trade, best risk-adjusted. Low trade count but every trade matters. The 2:1 TP:SL ratio (8%:4%) is why this works when momentum at 1.5:1 struggles.

**Recommendations:**
- **Increase position size base to 15%** (from 12%). This agent has edge — lean into it.
- **Relax ADX entry threshold to 18** (from 20). More entry opportunities without sacrificing quality.
- **Keep SL/TP ratio as-is.** The 2:1 reward:risk is the key differentiator vs momentum.
- **Consider lowering confidence threshold to 60%** (from 65%) to increase trade frequency.

---

### 4. RB Swing Trader (1D)

| Metric | Value |
|--------|-------|
| Net PnL | **+$132.41** |
| Trades | 6 (2W / 4L) |
| Win Rate | 33.3% |
| Avg/Trade | +$22.07 |
| Fees | $20.50 (13% of gross) |
| Drawdown | 18.1% |
| Current | SL: 4%, TP: 8%, Size: 12-20% |

**Diagnosis:** Low WR but high avg win compensates. The 2:1 TP:SL is working — losers lose small, winners win big. 18% drawdown is high for 6 trades.

**Recommendations:**
- **Widen TP to 10%** (from 8%). Daily timeframe has more range — capture bigger moves.
- **Widen SL to 5%** (from 4%). Daily candles are noisier. 4% SL may be getting triggered on normal volatility.
- **Reduce position size to 10%** (from 12%). Cuts drawdown risk with fewer but larger trades.
- **Keep low trade frequency.** Quality > quantity at this timeframe.

---

### 5. HYB Swing Trader (1D)

| Metric | Value |
|--------|-------|
| Net PnL | **+$78.33** |
| Trades | 10 (3W / 7L) |
| Win Rate | 30% |
| Avg/Trade | +$7.83 |
| Fees | $31.03 (28% of gross) |
| Current | SL: 4%, TP: 8%, Size: 12-20% |

**Diagnosis:** Similar pattern to pure swing 1D — low WR but net positive. More trades than pure swing (10 vs 6) likely from tweet relaxation.

**Recommendations:**
- **Same as RB Swing 1D:** Widen TP to 10%, SL to 5%.
- **Tighten tweet boost threshold.** The extra 4 trades (vs pure swing's 6) are mostly losses — tweet signal is adding noise, not edge.
- **Raise tweet sentiment threshold to 0.5** (from 0.3) for entry relaxation.

---

### 6. HYB Swing Trader (4H)

| Metric | Value |
|--------|-------|
| Net PnL | **+$46.84** |
| Trades | 6 (3W / 3L) |
| Win Rate | 50% |
| Avg/Trade | +$7.81 |
| Fees | $18.92 (29% of gross) |
| Current | SL: 4%, TP: 8%, Size: 12-20% |

**Diagnosis:** Solid. 50% WR with good avg. Same profile as pure swing 4H.

**Recommendations:**
- **Mirror RB Swing 4H recommendations.** Size up to 15%, relax ADX to 18.
- **Tweet boost is neither helping nor hurting** here — keep but monitor.

---

### 7. HYB Momentum Trader (1D)

| Metric | Value |
|--------|-------|
| Net PnL | **+$11.05** |
| Trades | 2 (1W / 1L) |
| Win Rate | 50% |
| Avg/Trade | +$5.53 |
| Current | SL: 4%, TP: 6%, Size: 8-15% |

**Diagnosis:** Too few trades to assess. Marginally positive.

**Recommendations:**
- **Widen TP to 8%** (from 6%). Daily timeframe needs wider targets.
- **Widen SL to 5%** (from 4%). Same rationale.
- **Relax bullish_score entry threshold to 0.65** (from 0.70) to generate more signals on daily.
- **Lower confidence requirement to 55%** (from 60%) for more opportunities.

---

### 8. RB Breakout Hunter (1H)

| Metric | Value |
|--------|-------|
| Net PnL | **-$59.01** |
| Trades | 80 (26W / 54L) |
| Win Rate | 32.5% |
| Avg/Trade | -$0.74 |
| Fees | $120.35 (196% of gross!) |
| Current | SL: 5%, TP: 10%, Size: 8% |

**Diagnosis:** Near breakeven on gross (+$61) but **fees destroy it** ($120). The 2:1 TP:SL ratio is correct in theory, but 32.5% WR means too many false breakouts. Lots of small losers.

**Recommendations:**
- **Add volume confirmation.** Require OBV slope > 5.0 (from 2.0). Current threshold catches too many low-conviction breakouts.
- **Add ADX rising filter.** Currently requires ADX < 25 (breakout from low vol). Add: ADX must be increasing (ADX > ADX_prev). Breakout with flat ADX = false signal.
- **Reduce position size to 6%** (from 8%). With 80 trades and 32% WR, smaller size limits fee accumulation.
- **Tighten Bollinger bandwidth to < 3%** (from 5%). Stricter squeeze = higher quality breakouts, fewer false signals.
- **Exit should NOT use band re-entry.** Current exit: close when price re-enters bands. This cuts winners too soon. Replace with: close on RSI extreme (>75 long, <25 short) or EMA cross.

---

### 9. HYB Breakout Trader (1H)

| Metric | Value |
|--------|-------|
| Net PnL | **-$235.05** |
| Trades | 81 (25W / 56L) |
| Win Rate | 30.9% |
| Avg/Trade | -$2.90 |
| Fees | $127.08 (118% of gross) |
| Current | SL: 5%, TP: 10%, Size: 8% |

**Diagnosis:** Worse than pure breakout. Tweet signals are adding false confidence to marginal breakouts, generating more losing entries.

**Recommendations:**
- **All RB Breakout 1H recommendations apply** (tighter squeeze, higher OBV, better exit).
- **Disable tweet boost for breakout.** Breakouts are technical events — tweet sentiment is adding noise. Only use tweet for exit (exit early if strong negative sentiment after long entry).
- **Consider pausing** this agent until breakout logic is improved. -$235 with 81 trades = consistent negative edge.

---

### 10. RB Breakout Hunter (4H) & HYB Breakout Trader (4H)

| Metric | RB | HYB |
|--------|-----|-----|
| Net PnL | -$7.66 | -$7.66 |
| Trades | 8 | 8 |
| Win Rate | 25% | 25% |
| Avg/Trade | -$0.96 | -$0.96 |
| Fees | $12.94 | $12.94 |

**Diagnosis:** Identical results (same signals, hybrid adds nothing). Near breakeven with too few trades to judge.

**Recommendations:**
- **Same as breakout 1H** but adapted for 4H: tighter squeeze threshold, higher volume confirmation.
- **These are fine to keep running** — small loss, low frequency, may improve with breakout tuning.

---

### 11. RB Mean Reversion (15M) — WORST FEE RATIO

| Metric | Value |
|--------|-------|
| Net PnL | **-$457.31** |
| Trades | 166 (91W / 75L) |
| Win Rate | 54.8% |
| Avg/Trade | -$2.75 |
| Fees | $300.92 (192% of gross!) |
| Drawdown | 21.8% |
| Current | SL: 3%, TP: 4%, Size: 10% |

**Diagnosis:** Highest trade count agent. WR is above 50% — **the strategy has edge** — but the 1.33:1 TP:SL ratio (4%:3%) combined with 0.2% round-trip fees on 15m destroys it. Fees alone are $301 on $156 gross — **fees are 2x the gross loss.**

**Recommendations:**
- **CRITICAL: Widen TP to at least 6%** (from 4%). Current 4% TP on 10% position = $4 avg win. After $2 fees = $2 net win. On a loss, 3% SL = $3 loss + $2 fees = $5 net loss. Asymmetric — wins must be larger.
- **Widen SL to 4%** (from 3%). 15m candles are noisy — 3% SL gets clipped by normal volatility.
- **Reduce position size to 6%** (from 10%). Cuts fees proportionally and limits per-trade risk.
- **Add minimum RSI distance filter.** Only enter when RSI < 25 (from 30) for longs or RSI > 75 (from 70) for shorts. Tighter oversold/overbought = higher conviction.
- **Replace mean-proximity exit with fixed TP.** Current exit triggers when price returns to EMA20 (0.3% from mean) — this is cutting winners at a tiny gain. Let TP at 6% do the heavy lifting.

---

### 12. HYB Mean Reversion Trader (15M)

| Metric | Value |
|--------|-------|
| Net PnL | **-$514.82** |
| Trades | 146 (78W / 68L) |
| Win Rate | 53.4% |
| Avg/Trade | -$3.53 |
| Fees | $259.19 (101% of gross) |
| Drawdown | 22.4% |
| Current | SL: 3%, TP: 4%, Size: 10% |

**Diagnosis:** Same disease as pure MR 15M. Fees = 101% of gross. Tweet integration doesn't help.

**Recommendations:**
- **Same as RB Mean Reversion 15M:** TP to 6%, SL to 4%, size to 6%, tighter RSI filter.
- **Disable tweet integration for mean reversion.** Mean reversion is counter-trend by nature — tweet momentum (which is trend-following) conflicts with the strategy thesis.

---

### 13. RB Mean Reversion (30M) & HYB Mean Reversion (30M)

| Metric | RB | HYB |
|--------|-----|-----|
| Net PnL | -$462.23 | -$425.02 |
| Trades | 90 / 82 | 51% / 52% WR |
| Fees | $159 / $144 | 53% / 51% of gross |
| SL/TP | 3% / 4% | 3% / 4% |
| Drawdown | 13.5% | 13.3% |

**Diagnosis:** Same pattern as 15M but slightly better fee ratio. 51-53% WR is edge that's being wasted on poor TP:SL ratio.

**Recommendations:**
- **Widen TP to 6%** (from 4%). 30M has more range than 15M.
- **Widen SL to 4%** (from 3%).
- **Reduce size to 7%** (from 10%).
- **Add ADX < 20 filter.** Mean reversion works in ranging markets. Adding ADX < 20 filters out trending regimes where MR gets steamrolled.

---

### 14. RB Mean Reversion (1H) & HYB Mean Reversion (1H)

| Metric | RB | HYB |
|--------|-----|-----|
| Net PnL | -$538.58 | -$560.05 |
| Trades | 69 / 57 | 42% / 40% WR |
| Fees | $136 / $112 | 34% / 25% of gross |
| SL/TP | 3% / 4% | 3% / 4% |
| Drawdown | 4.7% | 5.0% |

**Diagnosis:** WR drops to ~41% at 1H — mean reversion works worse on higher timeframes. 1H trends are more persistent, so "oversold" stays oversold longer.

**Recommendations:**
- **Consider pausing both.** 41% WR with 1.33:1 TP:SL has negative expectancy even with zero fees. This is not a parameter problem — mean reversion may not suit the 1H timeframe.
- **If keeping:** Widen SL to 5%, TP to 8%. At 1H, moves are bigger — need wider bands.
- **Add trend filter.** Only take long MR entries when 4H trend is bullish (price > EMA50 on 4H). Only take short when 4H is bearish. This avoids mean-reversion longs in genuine downtrends.

---

### 15. RB Mean Reversion (4H) & HYB Mean Reversion (4H)

| Metric | RB | HYB |
|--------|-----|-----|
| Net PnL | -$176.24 | -$121.48 |
| Trades | 21 / 13 | 33% / 31% WR |
| Avg/Trade | -$8.39 / -$9.34 | |

**Diagnosis:** 31-33% WR — mean reversion is a losing strategy at 4H. Oversold/overbought on 4H is often the start of a new trend, not a reversion opportunity.

**Recommendations:**
- **Pause both agents.** Mean reversion does not work on 4H with current parameters. The archetype fundamentally conflicts with 4H price behavior.
- **If keeping:** Require ADX < 15 (ranging only). Require Bollinger %B in extreme (< 0.02 or > 0.98). Add EMA200 trend alignment. But even with all filters, the edge is likely not there.

---

### 16. RB Mean Reversion (1D) & HYB Mean Reversion (1D)

| Metric | Both |
|--------|------|
| Net PnL | -$66.89 each |
| Trades | 2 (0W / 2L) |
| Drawdown | 10.6% |

**Diagnosis:** Only 2 trades, both losses. Too few to judge but directionally negative. 10.6% drawdown from 2 trades = oversized positions.

**Recommendations:**
- **Pause both.** Not enough data and MR doesn't work on higher TFs.
- **If keeping:** Reduce size to 5%, widen SL to 6%, TP to 10%.

---

### 17. RB Mean Reversion (1W)

| Metric | Value |
|--------|-------|
| Net PnL | **-$18.59** |
| Trades | 9 (4W / 5L) |
| Win Rate | 44% |
| Fees | $19.14 (3,480% of gross!) |

**Diagnosis:** Near-zero gross PnL (+$0.55) wiped out by fees. Barely trading. Fee ratio is absurd because gross is near zero.

**Recommendations:**
- **Pause.** Weekly mean reversion is too slow to generate meaningful PnL. 9 trades with $0.55 gross is not a viable strategy.

---

### 18. HYB Mean Reversion (1W)

| Metric | Value |
|--------|-------|
| Net PnL | -$92.04 |
| Trades | 7 (2W / 5L) |
| Win Rate | 28.6% |

**Recommendations:**
- **Pause.** Same as RB MR 1W.

---

### 19. RB Momentum Trader (1D)

| Metric | Value |
|--------|-------|
| Net PnL | **-$150.45** |
| Trades | 16 (5W / 11L) |
| Win Rate | 31.3% |
| Avg/Trade | -$9.40 |
| Fees | $25.42 (20% of gross) |
| Current | SL: 4%, TP: 6%, Size: 8-15% |

**Diagnosis:** WR is poor (31%) and TP:SL ratio of 1.5:1 doesn't compensate. Daily momentum needs bigger wins to offset the lower hit rate.

**Recommendations:**
- **Widen TP to 10%** (from 6%). Daily momentum trades should capture multi-day moves.
- **Widen SL to 6%** (from 4%). Daily candles are wide — 4% SL triggers on noise.
- **Lower bullish_score threshold to 0.65** (from 0.70). Too selective for daily — missing entries.
- **Reduce size to 6%** (from 8-15%). With 31% WR, smaller positions limit damage.

---

### 20. RB Momentum Trader (1W) & HYB Momentum Trader (1W)

| Metric | Both |
|--------|------|
| Net PnL | -$23.39 each |
| Trades | 3 (1W / 2L) |

**Diagnosis:** Too few trades. Marginally negative.

**Recommendations:**
- **Widen TP to 12%** (from 6%). Weekly moves are large — 6% TP is too tight.
- **Widen SL to 8%** (from 4%). Weekly noise easily exceeds 4%.
- **Reduce position size to 6%.** Weekly holds tie up capital — smaller positions maintain flexibility.

---

## Global Recommendations (All Agents)

### 1. Fix TP:SL Ratios
The single biggest lever. Most agents use 1.33:1 to 1.5:1 TP:SL — this requires >45% WR to break even after fees. Target **2:1 minimum** (e.g., 4% SL / 8% TP).

### 2. Scale Position Size by Timeframe
Current: 8-15% flat for momentum, 10% flat for mean reversion.
Proposed:

| Timeframe | Recommended Size |
|-----------|-----------------|
| 15m | 5% |
| 30m | 6% |
| 1h | 7% |
| 4h | 8% |
| 1d | 8% |
| 1w | 6% |

Short TFs need smaller size (fee sensitivity). Long TFs need smaller size (capital lockup).

### 3. Pause All Mean Reversion on 1H+ Timeframes
Mean reversion has negative expectancy at 1H, 4H, 1D, 1W. Only 15m and 30m have >50% WR, and even those need wider TP to be profitable.

### 4. Cap Concurrent Positions at 4 Per Agent
Several profitable agents (Momentum 4H, Swing 4H) hold 6 positions simultaneously, putting 50-90% of capital at risk. 4 positions at 8% each = 32% max deployment.

### 5. Add Trailing Stops to Winning Strategies
For momentum and swing agents with edge: after +3% unrealized, move SL to breakeven. Eliminates giving back gains on reversals.

### 6. Enable Twitter Polling
24 tweet agents and all hybrid tweet boosts are operating blind. No tweet data = no tweet signals = tweet agents sit idle, hybrid agents miss confirmation signals.
