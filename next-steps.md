# Next Steps

Potential features and improvements for Alpha Board, now that all 15 phases are complete.

> **Status key:** `PENDING` · `IN PROGRESS` · `COMPLETED`

---

## 1. Real-Time Updates (SSE / WebSocket) — `COMPLETED`

**What:** Push live ranking changes and agent decisions to the dashboard instead of relying on ISR revalidation intervals (60–3600 s).

**Why:** The current polling-via-ISR approach means users can wait up to 60 seconds (on the 15 m page) to see fresh data. Real-time streaming would make the dashboard feel alive—especially during volatile markets when agents are actively opening and closing positions.

**Implementation notes:**
- Add an SSE endpoint in the FastAPI worker (`/stream/rankings`, `/stream/agent-events`) that emits after each pipeline or agent cycle completes.
- On the web side, use an `EventSource` in a client component that merges incoming deltas into the server-rendered initial state.
- Alternatively, use Neon's `pg_notify` / LISTEN-NOTIFY to fan out change events without coupling the frontend to the worker directly.
- Keep ISR as the fallback for initial page loads; SSE only hydrates updates after mount.

---

## 2. Cross-Timeframe Agents — `COMPLETED`

**What:** Expand the 4 existing cross-timeframe agents (Confluence, Divergence, Cascade, Regime Detector) with richer multi-timeframe signal fusion.

**Why:** The current cross-TF agents already query multiple timeframes, but they treat each timeframe independently and merge at decision time. A deeper integration—where a higher timeframe trend explicitly gates a lower timeframe entry—could improve win rates and reduce whipsaws.

**Implementation notes:**
- Add a `CrossTimeframeContext` dataclass that bundles regime labels (trending / ranging / volatile) from 1 d and 4 h into every 15 m / 30 m agent cycle.
- Store regime labels in a new `timeframe_regimes` table (timeframe, regime, confidence, computed_at) so they persist across cycles.
- Modify `orchestrator.py` to inject the cross-TF context into the LLM prompt for lower-timeframe agents, letting them weight entries based on higher-timeframe alignment.
- Guard against circular dependencies: higher timeframes must always compute before lower ones consume their output.

---

## 3. Backtesting Framework — `COMPLETED`

**What:** Replay historical Binance candles through the existing pipeline and agent logic to evaluate strategy performance before deploying changes.

**Why:** Right now, the only way to test a prompt or indicator change is to wait for live candles. A backtesting mode would dramatically shorten the feedback loop for prompt evolution and new indicator experiments.

**Implementation notes:**
- Create a `worker/src/backtest/` module that replays candles from a local Parquet/CSV store (fetched once via `GET /api/v3/klines`).
- Re-use the existing `runner.py` pipeline and `orchestrator.py` agent cycle, but swap the live Binance client for a historical data iterator.
- Write results to a separate `backtest_runs` table (run_id, params, equity_curve, sharpe, max_drawdown) so they can be compared in the dashboard.
- On the web side, add a `/backtest` page that lets users pick a date range, select agents, and view an equity curve chart.

---

## 4. Performance Dashboard / Analytics Page — `COMPLETED`

**What:** A dedicated analytics page with aggregated metrics—total PnL over time, win-rate trends, drawdown charts, per-symbol hit rates, and token-cost breakdowns.

**Why:** The agent detail page shows individual performance, but there's no bird's-eye view across all 28 agents. An analytics page would surface which archetypes and timeframes are performing best and where costs are concentrated.

**Implementation notes:**
- Add a `/analytics` route in the Next.js app with server components that query aggregate views.
- Create SQL views or materialized views for: daily PnL by archetype, cumulative equity curves, win-rate rolling averages, and token cost per day (from `agent_token_usage`).
- Use a lightweight charting library (e.g., Recharts, already React-friendly) for equity curves and bar charts.
- Add filters for date range, timeframe, and archetype.

---

## 5. Advanced Charting (TradingView Lightweight Charts) — `COMPLETED`

**What:** Embed interactive candlestick charts with indicator overlays on the rankings and agent detail pages.

**Why:** The dashboard currently shows tabular data only. Seeing price action with the exact indicators the agents use (RSI, MACD, Bollinger Bands, EMAs) would make decision reasoning much easier to follow.

**Implementation notes:**
- Use [TradingView Lightweight Charts](https://github.com/nicehash/lightweight-charts) (`lightweight-charts` npm package)—it's free, performant, and renders on canvas.
- Add an API endpoint in the worker (`/api/candles/{symbol}/{timeframe}`) that returns OHLCV + computed indicator values from the existing pandas-ta pipeline.
- On the web side, create a `<CandlestickChart>` client component that fetches candle data and renders price + indicator sub-charts.
- On the agent detail page, overlay entry/exit markers from `agent_trades` onto the chart.

---

## 6. Agent Comparison Mode — `COMPLETED`

**What:** A side-by-side comparison view where users can select 2–4 agents and compare their equity curves, trade logs, and decision reasoning on the same symbols.

**Why:** With 28 agents it's hard to understand relative performance. A comparison mode would help identify which archetype works best for a given market condition and inform prompt evolution decisions.

**Implementation notes:**
- Add a `/agents/compare` page that accepts agent IDs as query params (`?ids=1,5,12`).
- Query `agent_portfolios`, `agent_trades`, and `agent_decisions` for the selected agents in parallel.
- Render overlaid equity curves (one line per agent) and a unified trade timeline.
- Include a "reasoning diff" panel that shows how each agent reasoned about the same symbol at the same timestamp.

---

## 7. Caching Layer (Redis) — `COMPLETED`

**What:** Add Redis (or Upstash Redis for serverless) as a caching layer between the database and both the worker and web app.

**Why:** The Neon database handles current load fine, but as the dataset grows (90 days of partitioned snapshots and decisions across 28 agents), frequently-read queries—like the rankings page, agent leaderboard, and health endpoint—could benefit from sub-millisecond cache hits.

**Implementation notes:**
- Use [Upstash Redis](https://upstash.com/) for a serverless-friendly, zero-infra option that works from both Vercel edge functions and the Fly.io worker.
- Cache the rankings query result per timeframe with a TTL matching the pipeline cadence (e.g., 15 min TTL for the 15 m timeframe).
- Invalidate on pipeline completion: after `runner.py` finishes a cycle, delete the relevant cache key so the next web request fetches fresh data.
- On the worker side, cache Binance API responses (order book, ticker) with short TTLs (5–10 s) to reduce external API calls during agent cycles.
- Start with read-through caching on the hottest queries; profile before expanding.

---

## 8. Symbol-Agent Cross-Referencing — `COMPLETED`

**What:** Connect symbol data with agent activity — see which agents are trading a symbol (from rankings/symbol pages) and filter agents by symbol (from the agents page).

**Why:** With 56 agents trading across multiple symbols, there was no way to see agent activity per symbol or discover which agents interacted with a given symbol. This makes it hard to connect market signals to agent behavior.

**Implementation notes:**
- New API route `/api/symbols/[symbol]/agents` returns open positions + recent trades across all agents for a symbol.
- Rankings page: expanding a symbol row now shows agent activity summary below the indicator breakdown, with expandable positions/trades tables.
- Symbol detail page: server-rendered agent activity section below the chart.
- Agents page: symbol search input filters the leaderboard to agents that interacted with the searched symbol, with a summary banner.

---

## 9. Twitter Feed Integration & Tweet-Driven Agents — `IN PROGRESS`

**What:** Connect to the Twitter API to ingest real-time tweets from a configurable list of accounts, extract sentiment/setups, and feed that context into two new agent tiers: **tweet-only agents** (trade purely on tweet signals) and **hybrid agents** (existing technical analysis + tweet context).

**Why:** On-chain and technical signals miss the narrative layer — influential accounts (analysts, founders, insiders) often move markets before indicators catch up. Adding tweet intelligence gives agents an information edge and lets us measure whether social signals improve or hurt performance vs. pure technicals.

**Implementation notes:**

### Phase 1 — Twitter Ingestion Pipeline
- Integrate with the **Twitter API v2** (Filtered Stream or polling via search/recent, depending on tier purchased).
- New `twitter_accounts` table: `id`, `handle`, `display_name`, `category` (analyst, founder, news, degen, etc.), `active`, `added_at`.
- New `tweets` table: `id`, `twitter_account_id`, `tweet_id`, `text`, `created_at`, `metrics` (likes, RTs, quotes), `ingested_at`.
- Admin UI on the web dashboard to **add/remove tracked accounts** — simple CRUD backed by a POST `/api/twitter/accounts` route (auth-protected).
- Worker module `worker/src/twitter/` with a streaming listener (or scheduled poller) that persists incoming tweets and broadcasts via SSE.

### Phase 2 — Sentiment & Setup Extraction — `COMPLETED`
- ~~**Multi-provider LLM analysis**~~: Using Claude Haiku directly (YAGNI on multi-provider — can add later).
- `tweet_signals` table with `sentiment_score` (-1 to +1), `setup_type`, `confidence`, `symbols_mentioned[]`, `reasoning`, token usage tracking.
- `TweetAnalyzer` class batches unanalyzed tweets (15 per batch), calls Claude Haiku via `tool_use`, persists results.
- Integrated into `TwitterPoller` — auto-analyzes after each poll when `tweet_analysis_enabled=True`.
- `POST /twitter/analyze` manual trigger endpoint; `GET /twitter/feed` returns signal data via LEFT JOIN.
- Web UI: sentiment badges (color-coded), setup type pills, symbol tags, reasoning toggle, stats dashboard (avg sentiment, signal breakdown).
- **Not implemented** (deferred): `TweetContext` dataclass for agent consumption — will be added in Phase 3/4.

### Phase 3 — Tweet-Only Agents — `COMPLETED`
- New agent class: **tweet-only** — trades purely on tweet signals without technical indicators.
- Create agents across **all 6 timeframes** (15m, 30m, 1h, 4h, 1d, 1w) — the timeframe determines how long the agent holds positions and how far back it looks at tweet history.
- Archetypes: `tweet_momentum` (ride hype), `tweet_contrarian` (fade overreaction), `tweet_narrative` (follow macro thesis), `tweet_insider` (weight founder/insider accounts higher).
- Each archetype runs as both `llm` and `rule` engine, mirroring existing convention.
- 4 archetypes × 6 timeframes × 2 engines = **48 tweet-only agents**.
- Migration `013_tweet_agents.py` adds `source` column to agents table and seeds all 48 agents with portfolios and prompts.
- Tweet context builder queries `tweet_signals` with timeframe-based lookback window.
- Tweet agents triggered after Twitter poll completes (gated by `tweet_agents_enabled` flag).
- Existing technical agents excluded from tweet cycles via `source` filtering in orchestrator.

### Phase 4 — Hybrid Agents (Technical + Tweets) `COMPLETED`
- 48 hybrid agents (4 archetypes × 6 TFs × 2 engines) combining technical indicators with tweet sentiment.
- 4 hybrid strategies: momentum, mean_reversion, breakout, swing — each uses technical signals as primary and tweets as confirmation/boost.
- Tagged with `source: hybrid`, run in normal pipeline cycle alongside technical agents.
- Pre-built tweet context once per timeframe in orchestrator to avoid redundant DB queries.

### Phase 5 — Dashboard & Analytics — `COMPLETED`
- Source filter on agent leaderboard (Technical / Tweet / Hybrid).
- Source badges (TECH, TW, HYB) on agent rows and detail pages.
- New "Sources" tab in analytics with PnL bar chart and breakdown table by source type.
- Expanded StrategyArchetype to include all 12 archetypes (4 base + 4 tweet + 4 hybrid).
- Fixed hardcoded agent count in analytics copy.
- **Deferred:** sentiment timeline chart, linking tweet signals to individual decisions.

### Summary — New Agent Count
| Source | Agents |
|--------|--------|
| Existing (technical) | 28 |
| Tweet-only (4 archetypes × 6 TFs × 2 engines) | 48 |
| Hybrid (4 archetypes × 6 TFs × 2 engines) | 48 |
| **Total** | **124** |

---

## 10. Consensus Ticker Banner — `COMPLETED`

**What:** A scrolling marquee banner pinned to the top of every page showing symbols where agents agree on direction (long or short). Three separate banners based on agent source type:

1. **Agent Consensus** — Based on the existing 28 technical analysis agents only.
2. **Twitter Consensus** — Based on tweet-only agents (from feature #9).
3. **Mixed Consensus** — Combined signal from all agent types (technical + tweet-only + hybrid).

**Why:** With 104 agents (post-feature #9), the dashboard surfaces a lot of individual decisions but no quick, glanceable signal for "what are agents collectively bullish or bearish on right now?" A consensus banner gives users an instant market pulse without drilling into tables—especially useful when multiple agents converge on the same symbol, which historically correlates with stronger moves.

**Implementation notes:**

### Marquee Component & Layout
- Create a `<ConsensusBanner>` client component that renders a continuously auto-scrolling horizontal marquee.
- Place it in `layout.tsx` so it appears at the top of every page, above the navigation.
- Each item in the marquee shows the **symbol name**, **direction** (LONG/SHORT), and **consensus percentage**.
- **Click** on any symbol → navigates to `/symbols/[symbol]` detail page.

### Two-Tier Consensus Coloring
- Display both long and short consensus simultaneously — a symbol can appear with a green badge (long consensus) and/or a red badge (short consensus) depending on agent agreement.
- **Moderate consensus (>50% agreement):** lighter/muted semantic color (muted green for long, muted red for short).
- **Strong consensus (>70% agreement):** vivid/accentuated semantic color (bright green for long, bright red for short).
- Symbols below the minimum threshold (50%) are excluded from the banner.
- **Configurable thresholds** — default 50%/70% but adjustable via a settings control or query param.

### Three Banner Rows
- Render three separate marquee rows, one per source type: `technical`, `tweet`, `mixed`.
- Each row is labeled and independently scrollable.
- The Twitter and Mixed rows only appear once feature #9 is deployed; until then, only the Agent Consensus row is active.

### Backend — Consensus Endpoint
- New SSE endpoint in the worker: `/stream/consensus` that emits consensus snapshots after each agent cycle completes.
- Consensus calculation: for each symbol and source type, count the percentage of agents with an open LONG vs SHORT position. Emit symbols exceeding the moderate threshold.
- Also expose a REST fallback `/api/consensus?source={technical|tweet|mixed}` for initial page load (SSE hydrates updates after mount, consistent with existing pattern from feature #1).

### Symbol Detail Page — Tweet Integration
- On `/symbols/[symbol]`, display a **Twitter mentions** section showing recent tweets that mention or relate to that asset (ties into feature #9's `tweets` and `tweet_signals` tables).
- Show tweet text, account handle, sentiment badge, and timestamp.
- This section only renders when feature #9 data is available.

### Summary
| Component | Location |
|-----------|----------|
| `<ConsensusBanner>` | `web/src/components/ConsensusBanner.tsx` |
| Layout integration | `web/src/app/layout.tsx` |
| SSE endpoint | `worker/src/api/consensus.py` |
| REST fallback | `worker/src/api/consensus.py` |
| Symbol tweet section | `web/src/app/symbols/[symbol]/page.tsx` |

---

## 11. Chart & KPI Visual Fixes (Analytics + Agents) — `COMPLETED`

**What:** Fix several visual issues that affect SVG charts and KPI cards across **both** the Analytics dashboard and the Agents pages (overview, comparison). The same chart components and patterns are reused — or duplicated with identical code — so the same bugs appear in multiple places.

**Why:** The analytics page and agent pages share chart patterns (`preserveAspectRatio="none"` SVG distortion, Y-axis label overlap, `tabular-nums` kerning) and directly reuse the `HorizontalBarChart` component (analytics + agent comparison). Fixing these in isolation on the analytics page would leave the same bugs on the agents pages. This item now covers all affected files in one pass.

**Shared component audit:**

| Component | Used on Analytics | Used on Agents | Same bug? |
|-----------|:-:|:-:|---|
| `HorizontalBarChart` | `analytics-dashboard.tsx` | `comparison-view.tsx` (line 110) | Yes — truncation (Fix 1), wasted space (Fix 5) |
| `CumulativePnlChart` | `analytics-dashboard.tsx` | — | Analytics only |
| `ArchetypeCurvesChart` | `analytics-dashboard.tsx` | — | Same SVG pattern — has Fix 2 + Fix 3 bugs |
| `EquityChart` | — | `agent-overview.tsx` (line 76) | Separate component, same SVG pattern — has Fix 2 + Fix 3 bugs |
| `ComparisonEquityChart` | — | `comparison-view.tsx` (line 98) | Separate component, same SVG pattern — has Fix 2 + Fix 3 bugs |
| `SummaryCards` | `analytics-dashboard.tsx` | — | Analytics only |
| Agent metrics grid | — | `agent-overview.tsx` (line 82–93) | Inline, not reused — has Fix 4 (`tabular-nums`) bug |

**Implementation notes:**

### Fix 1 — Truncated sublabels in horizontal bar charts
- **File:** `web/src/components/analytics/horizontal-bar-chart.tsx`
- **Affects:** Analytics (PnL by Archetype, PnL by Timeframe) **and** Agent Comparison (Total PnL bars) — both use the same component.
- The label column is `w-24 sm:w-28` (line 61) — too narrow for sublabels like `"257 trades · 28% win"`.
- The value column is `w-16 sm:w-20` (line 103) — tight for values like `$-3221.14`.
- **Fix:** Widen label column to `w-28 sm:w-36` and value column to `w-20 sm:w-24`.

### Fix 2 — Y-axis label overlap near $0 / baseline
- **Files (all affected):**
  - `web/src/components/analytics/cumulative-pnl-chart.tsx` — baseline `$0` vs max label
  - `web/src/components/analytics/archetype-curves-chart.tsx` (line 167) — same `$0` baseline overlap pattern
  - `web/src/components/agents/equity-chart.tsx` (line 128) — baseline at `initialBalance` vs max/min labels
  - `web/src/components/agents/comparison-equity-chart.tsx` (line 162) — baseline at `$10,000` vs max/min labels
- All four charts use the same proximity guard pattern (`Math.abs(...) > 20`) that only checks min vs max, but **not** baseline vs max/min.
- **Fix:** In each chart, add a proximity check between the baseline label (`$0` or `$10,000` or `initialBalance`) and the max/min labels. Suppress the baseline label when it would collide (< 20px apart). Consider extracting this into a shared `shouldShowLabel(yA, yB, minGap)` utility to avoid duplicating the logic 4 times.

### Fix 3 — SVG text distortion from `preserveAspectRatio="none"`
- **Files (all affected):**
  - `web/src/components/analytics/cumulative-pnl-chart.tsx` (line 99)
  - `web/src/components/analytics/daily-cost-chart.tsx` (line 101)
  - `web/src/components/analytics/archetype-curves-chart.tsx` (line 129)
  - `web/src/components/agents/equity-chart.tsx` (line 92)
  - `web/src/components/agents/comparison-equity-chart.tsx` (line 124)
- All five SVG charts use `preserveAspectRatio="none"` which stretches/squashes text labels (Y-axis, date labels, legends) as the container width changes.
- `archetype-curves-chart.tsx` and `comparison-equity-chart.tsx` also render **legend text inside the SVG**, making it doubly affected (both axis labels and legend labels distort).
- **Fix:** Move all text elements (Y-axis labels, date labels, value annotations, legends) out of the SVG into absolutely-positioned HTML overlays, keeping only path/line/circle data inside the SVG. Alternatively, switch to `preserveAspectRatio="xMidYMid meet"` and control chart sizing via the container. Apply consistently across all five files.

### Fix 4 — Monospace kerning gap in KPI cards ("$0 .86")
- **Files (all affected):**
  - `web/src/components/analytics/summary-cards.tsx` (line 79) — Token Cost card uses `font-mono text-lg tabular-nums`
  - `web/src/components/agents/agent-overview.tsx` (line 89) — Metrics grid uses `font-mono text-lg font-semibold tabular-nums` on all 8 metric cards (Total PnL, Return, Equity, Cash, Fees Paid, Token Cost, etc.)
- `tabular-nums` introduces visible gaps between characters in dollar values with decimals (e.g., "$0 .86", "$3 .21").
- **Fix:** Remove `tabular-nums` from the value text in both files, or use proportional font for dollar values with decimals. If `tabular-nums` is desired for alignment (e.g., tables), conditionally apply it only to integer values.

### Fix 5 — Wasted chart space when all bars are same-sign
- **File:** `web/src/components/analytics/horizontal-bar-chart.tsx`
- **Affects:** Analytics **and** Agent Comparison (same component).
- The bar chart splits into negative (left) and positive (right) halves. When all values are negative (common early on), the entire positive half is empty, wasting 50% of the chart width.
- **Fix:** Auto-detect when all values share the same sign and use full-width bars instead of the split layout. Only use the split layout when there's a mix of positive and negative values.

### Summary
| # | Issue | Files affected | Severity |
|---|-------|----------------|----------|
| 1 | Truncated sublabels in bar charts | `horizontal-bar-chart.tsx` (analytics + agent comparison) | High |
| 2 | Y-axis label overlap near baseline | `cumulative-pnl-chart.tsx`, `archetype-curves-chart.tsx`, `equity-chart.tsx`, `comparison-equity-chart.tsx` | Medium |
| 3 | SVG text distortion (`preserveAspectRatio="none"`) | `cumulative-pnl-chart.tsx`, `daily-cost-chart.tsx`, `archetype-curves-chart.tsx`, `equity-chart.tsx`, `comparison-equity-chart.tsx` | Medium |
| 4 | Monospace kerning gap (`tabular-nums`) | `summary-cards.tsx`, `agent-overview.tsx` | Low |
| 5 | Wasted positive half on all-negative data | `horizontal-bar-chart.tsx` (analytics + agent comparison) | Medium |

---

## 12. Rankings Table — Price/Volume Variation & Funding Rate — `COMPLETED`

**What:** Expand the rankings table with new data columns so users can see at a glance how price, volume, and funding rate are changing per timeframe.

**Why:** The rankings table currently shows indicator signals and scores, but not the raw price/volume dynamics that drive those signals. Adding variation columns lets users instantly spot which symbols are moving and whether volume confirms the move — without clicking into a chart. Funding rate surfaces crowded-trade risk directly in the table.

**New columns:**

### Price Variation (absolute + %)
Two sub-columns:
- **Intra-candle:** Change from the current candle's open to the latest price. Shows how the candle is developing in real time.
- **Candle-over-candle:** Change from the previous candle's close to the current candle's close. Shows the net move between completed candles.

### Volume Variation (absolute + %)
Two sub-columns:
- **Intra-candle:** Current candle volume vs average of recent candles. Highlights unusual volume spikes within the current period.
- **Candle-over-candle:** Current candle volume vs previous candle volume. Shows whether participation is increasing or fading.

### Funding Rate
- Current funding rate from Binance Futures API. Positive = longs pay shorts (crowded long), negative = shorts pay longs (crowded short). Useful for spotting overextended positioning.

**Implementation notes:**

### Worker — Data Collection & Computation
- The pipeline (`worker/src/pipeline/runner.py`) already fetches 200 OHLCV candles per symbol via `BinanceClient`. Price and volume variation can be computed from the existing candle data during the scoring step — no additional candle fetches needed.
- **Funding rate** requires a new Binance API call. Add a `get_funding_rates()` method to `worker/src/exchange/client.py` that calls `/fapi/v1/premiumIndex` (returns `lastFundingRate` per symbol in a single bulk request).
- Store the new metrics in the existing `indicator_signals` JSONB column on the `snapshots` table, under new keys: `price_var_intra`, `price_var_coc`, `volume_var_intra`, `volume_var_coc`, `funding_rate`.

### Web — Query & Display
- Update `web/src/lib/queries/rankings.ts` to extract the new fields from `indicator_signals` JSONB.
- Update `web/src/lib/types.ts` with the new fields on the rankings type.
- Update `web/src/components/rankings/rankings-table.tsx` to add column headers for Price Var, Volume Var, and Funding Rate.
- Update `web/src/components/rankings/ranking-row.tsx` to render the values with semantic coloring (green for positive, red for negative) and percentage formatting.

### Design Notes
- If the table feels too cluttered with both intra-candle and candle-over-candle sub-columns, ship both and prune later based on usage.
- On mobile, these columns can be hidden behind a horizontal scroll or collapsed into a tooltip.

### Summary
| Component | Change |
|-----------|--------|
| `worker/src/exchange/client.py` | Add `get_funding_rates()` method |
| `worker/src/pipeline/runner.py` | Compute price/volume variation, fetch funding rate |
| `web/src/lib/queries/rankings.ts` | Extract new JSONB fields |
| `web/src/lib/types.ts` | Add variation & funding rate types |
| `rankings-table.tsx` | New column headers |
| `ranking-row.tsx` | Render variation cells with coloring |

---

## 13. Smart Pruning — Symbol List Limit & Agent Auto-Discard — `COMPLETED`

**What:** Two related sub-features for managing scale: (a) limit the rankings to the top N symbols by volume, and (b) automatically discard agents that fall below a composite performance threshold.

**Why:** As the system grows — more symbols tracked, more agents running — noise and waste increase. Hundreds of low-volume symbols clutter the rankings, and poorly performing agents consume compute/tokens without contributing value. Smart pruning keeps the system focused on what matters.

### 13a. Symbol List Pruning — Top N by Volume

**Problem:** The rankings page shows every USDT pair on Binance above $1M 24h volume — potentially hundreds of symbols. Most are irrelevant noise that dilutes the useful signals.

**Solution:** Limit the rankings to the **Top N symbols by 24h volume** (e.g., top 100). Configurable N.

**Implementation notes:**
- The worker already fetches symbols sorted by 24h volume descending (`worker/src/exchange/client.py` → `get_active_symbols()`). Simply cap the list at N before running the pipeline.
- Add a `TOP_SYMBOLS_LIMIT` config to `worker/src/pipeline/runner.py` (default: 100).
- Symbols outside the top N are still tracked in the `symbols` table but won't get snapshots computed — saving pipeline time and database writes.
- Optionally expose this as a UI control on the rankings page so users can adjust (top 50, 100, 200) via a dropdown that passes the limit as a query param.

### 13b. Agent Auto-Discard — Composite Score Threshold

**Problem:** With 28+ agents (and 104 planned after feature #9), poorly performing agents consume compute/tokens and clutter the leaderboard. There's no mechanism to automatically sideline them.

**Solution:** Automatically discard agents that fall below a **composite performance score**, moving them to a "Discarded" tab with the reason. Manual cleanup available.

**Composite score formula** (weighted, all configurable):
| Metric | Example Threshold | Weight |
|--------|-------------------|--------|
| Max drawdown % | Discard if > 50% | High |
| Win rate | Flag if < 15% over 50+ trades | Medium |
| Trade count | Minimum 20 trades before evaluation | Gate |

- Weighted score produces a health grade (0–100). Agents below the threshold (e.g., < 30) get auto-discarded.
- Thresholds and weights are configurable via environment variables or a config table.

**Implementation notes:**

#### Database
- Add columns to the `agents` table: `status` (`active` | `discarded`, default `active`), `discarded_at` (timestamp, nullable), `discard_reason` (text, nullable).
- Migration in `worker/alembic/versions/`.

#### Worker — Evaluation Logic
- After each agent cycle in `worker/src/agents/orchestrator.py`, check the agent's composite score against the threshold.
- If below threshold → update `status = 'discarded'`, set `discarded_at = now()`, and record `discard_reason` (e.g., "Max drawdown 63% exceeded 50% limit; win rate 12% below 15% minimum").
- Discarded agents are skipped in future cycles: the orchestrator filters on `status = 'active'` before running agents.

#### Web — Discarded Agents Tab
- On the Agents page (`web/src/app/agents/`), add a **"Discarded"** tab alongside the existing agent list.
- The Discarded tab shows: agent name, archetype, timeframe, discard reason, discard date, and two action buttons:
  - **Re-activate** — sets `status = 'active'`, clears `discarded_at` and `discard_reason`. Agent resumes in the next cycle.
  - **Delete permanently** — removes the agent and all associated data (with confirmation dialog).

### Summary
| Component | Change |
|-----------|--------|
| `worker/src/pipeline/runner.py` | Add `TOP_SYMBOLS_LIMIT` config, cap symbol list |
| `worker/src/exchange/client.py` | Respect symbol limit in `get_active_symbols()` |
| `worker/alembic/versions/` | Migration: add `status`, `discarded_at`, `discard_reason` to `agents` |
| `worker/src/agents/orchestrator.py` | Composite score check, auto-discard logic, filter on `status` |
| `web/src/app/agents/` | Discarded tab with re-activate and delete actions |
| `web/src/lib/queries/agents.ts` | Query discarded agents separately |

---

## 14. Database Provider Evaluation Report — `COMPLETED`

**What:** A comprehensive evaluation of database providers (Postgres-compatible and otherwise) to inform whether Alpha Board should stay on Neon or migrate — and if so, where.

**Result:** Stay with Neon (recommended). Full evaluation documented in [`dbprovider.md`](./dbprovider.md).

---

## 15. System Status Page — `COMPLETED`

**What:** A dedicated `/status` page showing real-time operational health of all Alpha Board services — frontend, worker, database, Redis, Binance API, Twitter polling, pipeline runs, and SSE streams. Inspired by [status.claude.com](https://status.claude.com/) but adapted to the dark e-ink aesthetic.

**Why:** With 8 interconnected services (Vercel, Fly.io, Neon, Upstash, Binance, Twitter, pipelines, SSE), there's no single view showing whether everything is healthy. When something breaks — a missed pipeline run, a stale Twitter poll, a Redis timeout — the only way to find out is to notice stale data in the dashboard. A status page provides instant visibility into system health and historical reliability.

**Design reference:** [status.claude.com](https://status.claude.com/) — service rows with 90-day heatmap timelines and uptime percentages, adapted to Alpha Board's dark monochrome palette with semantic colors (bullish green / bearish red / neutral yellow) for status indicators.

**Implementation notes:**

### Phase 1 — Health Check Infrastructure (Worker)

#### New table: `service_health_checks`
```sql
CREATE TABLE service_health_checks (
    id BIGSERIAL PRIMARY KEY,
    service VARCHAR(50) NOT NULL,        -- 'frontend', 'worker_api', 'database', 'redis', 'binance_api', 'twitter_polling', 'pipeline_15m', ..., 'sse_rankings', etc.
    status VARCHAR(20) NOT NULL,          -- 'operational', 'degraded', 'down'
    latency_ms INTEGER,                   -- response time in milliseconds
    error_message TEXT,                    -- null when healthy, error details when degraded/down
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_checks_service_time ON service_health_checks (service, checked_at DESC);
```

#### New table: `service_daily_status`
```sql
CREATE TABLE service_daily_status (
    id SERIAL PRIMARY KEY,
    service VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    total_checks INTEGER NOT NULL,
    successful_checks INTEGER NOT NULL,
    uptime_pct NUMERIC(5,2) NOT NULL,     -- e.g., 99.72
    avg_latency_ms INTEGER,
    max_latency_ms INTEGER,
    incidents INTEGER NOT NULL DEFAULT 0,  -- count of downtime periods that day
    worst_status VARCHAR(20) NOT NULL,     -- worst status seen that day: 'operational', 'degraded', 'down'
    UNIQUE(service, date)
);
```

#### New table: `service_incidents` (auto-detected)
```sql
CREATE TABLE service_incidents (
    id SERIAL PRIMARY KEY,
    service VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,           -- 'degraded' or 'down'
    started_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,               -- null if ongoing
    duration_minutes INTEGER,              -- computed on resolution
    error_summary TEXT                     -- most common error message during the incident
);

CREATE INDEX idx_incidents_service_time ON service_incidents (service, started_at DESC);
```

#### Health checker module: `worker/src/health/checker.py`
- New APScheduler job running **every 2 minutes**.
- Pings all 8+ service categories and writes results to `service_health_checks`.
- **Incident auto-detection:** If a service transitions from `operational` → `degraded`/`down`, insert a new row in `service_incidents`. When it recovers, set `resolved_at` and compute `duration_minutes`.
- **Daily rollup:** A separate scheduled job (runs once at midnight UTC) aggregates the day's checks into `service_daily_status` for efficient 90-day queries.
- **Retention:** Purge raw `service_health_checks` rows older than 7 days (the daily rollup preserves the summary). Keep `service_daily_status` for 180 days.

#### Service check implementations:

| Service | Check Method | Degraded threshold | Down threshold |
|---------|-------------|-------------------|----------------|
| **Frontend (Vercel)** | HTTP GET `https://alpha-board.com` — expect 200 | Response > 3s | Timeout / non-200 |
| **Worker API (Fly.io)** | HTTP GET `https://alpha-worker.fly.dev/health` — expect 200 + JSON | Response > 2s | Timeout / non-200 |
| **Database (Neon)** | `SELECT 1` via existing async DB connection | Query > 500ms | Connection error / timeout |
| **Redis (Upstash)** | `PING` via existing Redis client | Response > 200ms | Connection error / timeout |
| **Binance API** | HTTP GET `https://api.binance.com/api/v3/ping` | Response > 1s | Timeout / non-200 |
| **Twitter Polling** | Query `tweets` table for latest `ingested_at` — compare to expected cadence (15 min) | Last tweet > 30 min ago | Last tweet > 60 min ago |
| **Pipeline Runs** (×6 TFs) | Query `computation_runs` for latest `completed_at` per timeframe — compare to expected cadence | Missed by > 1.5× cadence | Missed by > 3× cadence |
| **SSE Streams** | Attempt `EventSource` connection to `/sse/rankings`, `/sse/agents`, `/sse/consensus` — expect initial message within 5s | Slow initial response (> 3s) | Connection refused / timeout |

### Phase 2 — Status API Endpoints (Worker)

#### `GET /status/current`
Returns current status for all services:
```json
{
    "overall": "operational",        // worst status across all services
    "services": [
        {
            "name": "Frontend (Vercel)",
            "slug": "frontend",
            "status": "operational",
            "latency_ms": 245,
            "last_checked": "2026-02-17T15:30:00Z"
        },
        ...
    ],
    "active_incidents": []           // any ongoing incidents from service_incidents
}
```

#### `GET /status/history?days=90`
Returns daily status for the heatmap:
```json
{
    "services": [
        {
            "slug": "frontend",
            "name": "Frontend (Vercel)",
            "uptime_30d": 99.95,
            "uptime_60d": 99.87,
            "uptime_90d": 99.91,
            "daily": [
                { "date": "2026-02-17", "status": "operational", "uptime_pct": 100.0, "incidents": 0 },
                { "date": "2026-02-16", "status": "degraded", "uptime_pct": 97.22, "incidents": 1 },
                ...
            ]
        },
        ...
    ]
}
```

#### `GET /status/incidents?service={slug}&days=90`
Returns resolved + active incidents for a service, used in tooltip/detail views.

### Phase 3 — Status Page (Web)

#### New route: `web/src/app/status/page.tsx`
Server component with ISR revalidation every 60 seconds. Fetches from `/status/current` and `/status/history?days=90`.

#### Layout — Top-level summary
- **Overall status banner** at the top:
  - All operational → green banner: "All Systems Operational"
  - Any degraded → yellow banner: "Partial System Degradation"
  - Any down → red banner: "Service Disruption"
- Uses existing semantic color tokens (`--bullish-strong` for green, `--neutral-strong` for yellow, `--bearish-strong` for red).

#### Layout — Service rows
Each service gets a card/row containing:
1. **Status indicator dot** (green / yellow / red) + **service name**
2. **Current latency** (e.g., "245ms")
3. **90-day heatmap timeline** — horizontal row of 90 small rectangles (one per day), color-coded:
   - `--bullish-strong` (#22C55E) → 100% uptime (operational all day)
   - `--bullish-muted` (#166534) → ≥99% uptime (brief degradation)
   - `--neutral-strong` (#FBBF24) → ≥95% uptime (noticeable degradation)
   - `--bearish-muted` (#991B1B) → ≥90% uptime (significant issues)
   - `--bearish-strong` (#EF4444) → <90% uptime (major outage)
   - `--bg-muted` (#262626) → no data
4. **Uptime percentages** — 30d / 60d / 90d displayed to the right of the heatmap
5. **Hover tooltip** on each day block showing: date, uptime %, incident count, and incident details if any

#### Layout — Active incidents section
Below the service rows, show any ongoing incidents:
- Service name, status (degraded/down), duration so far, error summary
- Auto-populated from `service_incidents` where `resolved_at IS NULL`

#### Layout — Recent incidents section
Below active incidents, a chronological list of resolved incidents from the past 14 days:
- Date, service, duration, error summary
- Grouped by date (like Claude's "Past Incidents" section)

#### Components:
| Component | File |
|-----------|------|
| `<StatusPage>` | `web/src/app/status/page.tsx` |
| `<StatusOverview>` | `web/src/components/status/status-overview.tsx` — overall banner + service list |
| `<ServiceRow>` | `web/src/components/status/service-row.tsx` — single service with heatmap |
| `<UptimeHeatmap>` | `web/src/components/status/uptime-heatmap.tsx` — 90-day color-coded timeline |
| `<IncidentList>` | `web/src/components/status/incident-list.tsx` — active + recent incidents |

#### Navigation
- Add "Status" link to the site navigation (`nav-links.tsx`).

### Phase 4 — Real-Time Updates (Optional Enhancement)

- Add SSE endpoint `/sse/status` that emits when a service status changes.
- The status page can use the existing `useSSE` hook pattern to show live status transitions without page reload.
- Low priority — ISR with 60s revalidation is sufficient for an initial release.

### Summary

| Component | Location |
|-----------|----------|
| Migration (3 tables) | `worker/alembic/versions/016_service_health.py` |
| Health checker module | `worker/src/health/checker.py` |
| Status API endpoints | `worker/src/api/status.py` |
| APScheduler jobs | `worker/src/scheduler.py` (2-min check + daily rollup) |
| Status page | `web/src/app/status/page.tsx` |
| Status components | `web/src/components/status/` (4 components) |
| Nav link | `web/src/components/nav-links.tsx` |

### Services Monitored

| # | Service | Source |
|---|---------|--------|
| 1 | Frontend (Vercel) | HTTP ping alpha-board.com |
| 2 | Worker API (Fly.io) | HTTP ping /health |
| 3 | Database (Neon) | SQL SELECT 1 |
| 4 | Redis (Upstash) | PING command |
| 5 | Binance API | HTTP ping /api/v3/ping |
| 6 | Twitter Polling | Last ingested tweet vs cadence |
| 7 | Pipeline Runs (×6 TFs) | Last computation_run vs schedule |
| 8 | SSE Streams | Connection test |

---

## 16. Fleet Lessons (Learn from Discarded Agents) — `COMPLETED`

**What:** Post-mortem LLM analysis on discarded agents extracts structured "fleet lessons" (strengths, mistakes, patterns) scoped by strategy archetype. Lessons are injected into evolution context and optionally into decision context (gated by `FLEET_LESSONS_IN_CONTEXT` flag).

**Why:** When Smart Pruning auto-discards underperforming agents, their experience was lost. Fleet lessons preserve institutional knowledge across agent generations, helping new agents avoid the same mistakes.

**Implementation:**
- Migration 016: `fleet_lessons` table with archetype index
- `PostMortemAnalyzer` class using Claude Haiku with `tool_use` to extract 3-7 structured lessons
- Orchestrator triggers post-mortem after auto-discard (LLM agents only)
- Evolution context injects fleet lessons (always active)
- Decision context injection gated by `FLEET_LESSONS_IN_CONTEXT` env var
- UI: Collapsible section on agents page with category filters (strength/mistake/pattern) and per-lesson removal

---

## 17. Absolute Price & Volume Change in Rankings — `COMPLETED`

**What:** Add absolute (dollar/unit) price and volume change columns alongside the existing percentage columns in the rankings table across all six timeframes. Currently only candle-over-candle percentage changes are shown — this adds the raw magnitude so users can see *how much* moved, not just the relative shift.

**Why:** Percentage changes alone hide scale. A 5% move on BTC ($96k → $100.8k, +$4.8k) is a very different signal than 5% on a $0.02 altcoin (+$0.001). Absolute values let users instantly gauge the dollar magnitude of moves and compare volume in real terms (e.g., "$42M → $68M" vs "+62%"). This is especially useful for position sizing intuition and spotting volume anomalies.

**New columns per timeframe:**

| Column | Description | Example |
|--------|-------------|---------|
| Price Δ | Absolute price change (current close − previous close) | +$4,823.50 |
| Vol Δ | Absolute volume change (current candle volume − previous candle volume) in quote currency | +$26.1M |

**Implementation notes:**

### Worker — Compute absolute changes

File: `worker/src/pipeline/runner.py`

The pipeline already computes `price_change_pct` and `volume_change_pct` from the last two candles. Add two new fields computed at the same point:

```python
price_change_abs = curr_close - prev_close  # raw dollar change
volume_change_abs = curr_vol - prev_vol      # raw volume change (quote currency)
```

Store both in the existing `indicator_signals` JSONB on the `snapshots` table under keys `price_change_abs` and `volume_change_abs` (same pattern as `funding_rate`). Alternatively, add to the `SymbolData` dataclass and persist as top-level JSONB fields — whichever matches the existing `price_change_pct` storage path.

### Worker — SymbolData / persistence

File: `worker/src/pipeline/runner.py` (SymbolData dataclass)

Add `price_change_abs: float | None` and `volume_change_abs: float | None` fields. Pass them through to snapshot persistence, stored in the same JSONB column or market data blob where `price_change_pct` lives.

### Web — Types

File: `web/src/lib/types.ts`

Add to `RankingSnapshot`:
```ts
priceChangeAbs: number | null;
volumeChangeAbs: number | null;
```

### Web — Query

File: `web/src/lib/queries/rankings.ts`

Extract the new fields from the JSONB/market data, same pattern as `priceChangePct`.

### Web — Table display

File: `web/src/components/rankings/ranking-row.tsx`

Add two new cells next to the existing percentage columns:
- **Price Δ**: Format with `$` prefix, sign, and smart precision (2 decimals for >$1, 4+ decimals for sub-cent tokens). Color: green positive, red negative.
- **Vol Δ**: Format with `$` prefix and compact notation ($1.2M, $340K). Color: green positive, red negative.

File: `web/src/components/rankings/rankings-table.tsx`

Add column headers "Price Δ" and "Vol Δ". Make them sortable (same pattern as existing price/volume columns).

### Design notes
- On mobile, absolute columns can share a cell with percentage via a stacked layout (% on top, abs below) or be hidden behind horizontal scroll.
- Consider a compact format: `+$4.8k (+5.0%)` in a single cell if table width becomes a concern.

### Summary

| Component | Change |
|-----------|--------|
| `worker/src/pipeline/runner.py` | Compute `price_change_abs`, `volume_change_abs` from candle data |
| `web/src/lib/types.ts` | Add `priceChangeAbs`, `volumeChangeAbs` to `RankingSnapshot` |
| `web/src/lib/queries/rankings.ts` | Extract new fields from snapshot data |
| `web/src/components/rankings/ranking-row.tsx` | Render absolute change cells with formatting |
| `web/src/components/rankings/rankings-table.tsx` | Add column headers + sort support |

---

## 18. Explanatory Tooltips & Hints — `COMPLETED`

**What:** Add hover tooltips throughout the rankings UI to explain concepts, definitions, and how values are calculated. First-time visitors and non-technical users should be able to understand every metric without leaving the page.

**Why:** Terms like "bullish score," "confidence," "funding rate," and indicator names (EMA, MACD, BB) are opaque to newcomers. A lightweight tooltip layer turns the dashboard into a self-documenting tool without cluttering the layout.

**Where to add tooltips:**

### Column headers (rankings table)
| Header | Tooltip text |
|--------|-------------|
| Score | Composite bullish score (0–1). Aggregated from all technical indicators weighted by reliability. >0.6 = bullish, <0.4 = bearish. |
| Conf | Confidence percentage. Measures indicator agreement — high confidence means most indicators align in the same direction. |
| Price % | Price change percentage over the selected timeframe candle vs. previous candle. |
| Price Δ | Absolute price change in USD over the selected timeframe. |
| Vol % | Volume change percentage over the selected timeframe candle vs. previous candle. |
| Vol Δ | Absolute volume change in quote currency over the selected timeframe. |
| Funding | Perpetual futures funding rate. Negative = shorts paying longs (contrarian bullish). Positive = longs paying shorts. |
| Highlights | Notable technical patterns detected by the indicator engine for this symbol. |

### Score bar (visual bar in Score column)
- Tooltip on hover showing: "Bullish Score: 0.739 — Aggregated from {N} indicators. Green = bullish bias, Red = bearish bias."

### Highlight chips
Each chip gets a tooltip explaining the pattern:
| Chip | Tooltip |
|------|---------|
| Strong Uptrend | Price is in a strong upward trend across multiple moving averages. |
| EMA Bullish | Exponential Moving Average crossover: short-term EMA is above long-term EMA, signaling upward momentum. |
| MACD Bullish | MACD line crossed above signal line, indicating potential upward momentum. |
| Strong Buying | Volume significantly exceeds recent average, suggesting strong buyer interest. |
| BB Squeeze | Bollinger Bands are narrowing, often preceding a large price move. |
| Above BB Upper | Price is above the upper Bollinger Band, signaling overbought conditions or strong momentum. |
| No Trend | No clear directional trend detected; price is moving sideways. |

### Indicator breakdown (expanded row)
- Each indicator row in the expanded breakdown section gets a tooltip explaining what the indicator measures and how its signal is derived.

### Implementation notes

**Tooltip component:**
- Use Radix UI `Tooltip` (already available via shadcn — install `@radix-ui/react-tooltip` if not present).
- Create a lightweight `<InfoTooltip content="..." />` wrapper that renders a small `(i)` icon or wraps existing text.
- For column headers: wrap the header text so hovering the header shows the tooltip.
- For chips/bars: wrap the element itself.
- Delay: 300ms open, 0ms close. Max width: 280px. Dark theme styled to match `--bg-elevated` / `--text-primary`.

**Files to modify:**

| Component | Change |
|-----------|--------|
| `web/src/components/ui/info-tooltip.tsx` | New shared tooltip wrapper component |
| `web/src/components/rankings/rankings-table.tsx` | Add tooltips to all column headers |
| `web/src/components/rankings/score-bar.tsx` | Add tooltip to the score bar visual |
| `web/src/components/rankings/highlight-chip.tsx` | Add tooltip to each highlight chip |
| `web/src/components/rankings/indicator-breakdown.tsx` | Add tooltip to each indicator name |
| `web/src/components/rankings/ranking-row.tsx` | Minor adjustments if needed for tooltip integration |

**Design notes:**
- Tooltips should feel native to the dark e-ink aesthetic — no bright backgrounds or jarring animations.
- On mobile/touch: tooltips trigger on tap (Radix handles this automatically).
- Keep tooltip text concise (1–2 sentences max).

---

## 19. Agent Integrity Audit & Telegram Parity — `COMPLETED`

**What:** Thorough end-to-end audit of the agent system ensuring PnL accuracy, proper lifecycle behavior, clear data presentation, and Telegram notification parity with the web UI. Every number on the site must be verifiable against raw trades, and every Telegram message must match what the site shows.

**Why:** The agent fleet is the core product. If PnL numbers don't add up, timestamps are missing, or Telegram shows different data than the site, trust in the system collapses. This is a hardening pass — no new features, just making the existing system bulletproof.

---

### 19.1 — Differentiate Unrealized PnL (uPnL) vs Realized PnL

**Current state:** The `AgentPortfolio` table has `total_realized_pnl` and `total_equity`, but the web UI only shows a single "Total PnL" value computed as `total_equity - initial_balance`. This conflates realized gains from closed trades with paper gains from open positions.

**Changes:**

#### Web types (`web/src/lib/types.ts`)
Add to `AgentDetail`:
```ts
realizedPnl: number;    // sum of all closed trade PnLs
unrealizedPnl: number;  // sum of all open position uPnLs
```

#### Web query (`web/src/lib/queries/agents.ts`)
Return both values from the portfolio query:
```sql
p.total_realized_pnl as realized_pnl,
(p.total_equity - p.cash_balance - p.total_realized_pnl) as unrealized_pnl
```
Or simpler: sum `unrealized_pnl` from `agent_positions` for the open uPnL.

#### Agent leaderboard (`web/src/components/agents/agent-leaderboard.tsx`)
- Add columns or sub-labels: **Realized PnL** and **uPnL** (unrealized) alongside the existing Total PnL.
- Color coding: realized = solid green/red, unrealized = dimmed/italic green/red to visually distinguish.

#### Agent overview tab (`web/src/components/agents/agent-overview.tsx`)
- Metrics grid: split "Total PnL" into three cards:
  - **Total PnL** (equity − initial balance, as today)
  - **Realized PnL** (from closed trades only)
  - **Unrealized PnL** (from open positions)
- Tooltips on each explaining the difference.

#### Open positions table
- Already shows `uPnL` per position — keep as-is but ensure the sum matches the portfolio-level `unrealizedPnl`.

---

### 19.2 — Paused Agents Stop Computing PnL

**Current state:** The orchestrator filters `status == "active"` so paused agents don't run cycles. However, their open positions still have stale `unrealized_pnl` values from the last cycle they ran. This means:
- A paused agent with open positions shows a frozen uPnL that drifts from reality.
- If resumed, the first cycle updates uPnL and may trigger unexpected SL/TP hits at prices that moved significantly.

**Changes:**

#### Option A — Force-close on pause (recommended)
When an agent is paused (via API or admin action), automatically close all open positions at current market price. This:
- Crystallizes all PnL into realized
- Eliminates stale uPnL confusion
- Makes the "paused" state clean (no positions, no ongoing risk)

Implementation:
- Add `POST /agents/{id}/pause` endpoint in worker
- Endpoint: set `status = "paused"`, call `portfolio_manager.close_all_positions(agent_id, current_prices, reason="agent_paused")`
- Log trades with `exit_reason = "agent_paused"`
- Send Telegram notification: "Agent {name} paused — {N} positions closed"

#### Option B — Keep positions but update uPnL
If we want paused agents to keep positions:
- Add paused agent IDs to the price update loop (separate from decision cycle)
- Update `unrealized_pnl` every cycle even for paused agents
- But never call the decision engine or check SL/TP
- Show a "PAUSED" badge next to uPnL values

**Recommendation:** Option A is simpler and avoids confusion.

#### Web UI
- Add a pause/unpause button on the agent detail page (admin only)
- Show `pausedAt` timestamp when agent is paused
- Paused agents should be visually dimmed in the leaderboard

---

### 19.3 — Agent Unique IDs (UUID)

**Current state:** Agents have integer auto-increment IDs (1, 2, 3...). These work fine internally but are fragile for:
- Cross-system references (Telegram messages referencing agent #5 could collide if DB is ever reset)
- External integrations (webhook callbacks, audit logs)
- Multi-instance deployments

**Changes:**

#### Database migration (018)
- Add `uuid` column to `agents` table: `UUID DEFAULT gen_random_uuid()`, unique, not null
- Backfill existing agents with generated UUIDs
- Add index on `uuid`

#### Worker models (`worker/src/models/db.py`)
- Add `uuid: Mapped[str] = mapped_column(UUID, server_default=text("gen_random_uuid()"), unique=True)`

#### Telegram messages
- Include short UUID prefix in all agent notifications: `[a3f7b2] Momentum 15m #1 opened LONG...`
- This makes messages greppable and cross-referenceable

#### Web UI
- Show UUID (truncated to 8 chars) in agent detail header
- Add copy-to-clipboard on click
- Agent URLs can optionally use UUID: `/agents/a3f7b2c4-...` (keep integer ID as primary route)

#### API responses
- Include `uuid` field in all agent API responses alongside `id`

---

### 19.4 — Timestamps Visible on All Agent Actions

**Current state:** Trade history shows `closedAt` as relative time ("5 hours ago"). But:
- Decision timestamps (`decided_at`) are not shown in the Reasoning tab
- Position `opened_at` is shown but only as relative time
- No absolute timestamps anywhere (important for audit/debugging)

**Changes:**

#### Trade history tab (`web/src/components/agents/trade-history.tsx`)
- Show both absolute and relative timestamps:
  - `Opened: Feb 17, 14:32 UTC (3h ago)`
  - `Closed: Feb 17, 17:45 UTC (12m ago)`
- Add `openedAt` column (currently only `closedAt` is displayed)
- Show trade duration prominently (already have `duration_minutes`)

#### Reasoning tab (`web/src/components/agents/agent-reasoning.tsx`)
- Add `decided_at` timestamp to each decision entry
- Show both absolute and relative time
- For hold decisions: show timestamp + "HOLD — no action taken"

#### Open positions table (`web/src/components/agents/agent-overview.tsx`)
- Show `opened_at` as absolute timestamp
- Show duration: "Open for 2h 15m"

#### Agent detail header
- Show `created_at` (agent creation date)
- Show `last_cycle_at` (last time agent ran a decision cycle)
- If discarded: show `discarded_at` + `discard_reason`

---

### 19.5 — Telegram Notification Parity with Web UI

**Current state:** Telegram sends notifications for trade opens, closes, equity alerts, evolutions, and daily digests. But:
- Telegram messages don't include the agent UUID (only name)
- No link back to the web UI from Telegram messages
- PnL in Telegram messages may not match the web (different calculation timing)
- No Telegram notification for agent pause/unpause
- No Telegram notification for agent discard (auto-pruning)
- Daily digest doesn't include per-agent uPnL breakdown

**Changes:**

#### Message templates (`worker/src/notifications/templates.py`)

**Trade opened message — add:**
- Agent UUID prefix: `[a3f7b2]`
- Link to agent page: `<a href="https://alpha-board.com/agents/{id}">View agent →</a>`
- Current portfolio cash after trade
- Number of open positions after this trade

**Trade closed message — add:**
- Agent UUID prefix
- Link to agent page
- Cumulative realized PnL (not just this trade's PnL)
- Updated equity after close
- Win/loss streak count

**Daily digest — add:**
- Per-agent breakdown: name, uuid, equity, realized PnL, uPnL, open positions count
- Fleet totals: total equity, total realized PnL, total uPnL
- Best/worst performer of the day
- Agents paused/discarded in the last 24h

**New notifications — add:**
- `notify_agent_paused(agent, positions_closed, reason)`
- `notify_agent_discarded(agent, health_score, reason, post_mortem_summary)`
- Add corresponding preference toggles: `notify_agent_paused`, `notify_agent_discarded`

#### Notification service (`worker/src/notifications/service.py`)
- Add methods for new notification types
- Ensure PnL values sent to Telegram use the **exact same calculation** as the web query (snapshot at notification time, not a different formula)

---

### 19.6 — PnL Integrity Verification

**Goal:** Mathematical proof that `total_pnl = sum(trade.pnl) + sum(position.unrealized_pnl)` at all times.

**Changes:**

#### Worker — PnL reconciliation check (`worker/src/agents/portfolio.py`)
Add a `reconcile_pnl(agent_id)` method that:
1. Sums all `agent_trades.pnl` for the agent → `sum_realized`
2. Sums all `agent_positions.unrealized_pnl` → `sum_unrealized`
3. Compares `sum_realized` with `portfolio.total_realized_pnl`
4. Compares `sum_realized + sum_unrealized + initial_balance` with `portfolio.total_equity`
5. If discrepancy > $0.01, logs a WARNING with full breakdown
6. Returns `(is_consistent: bool, discrepancy: float, details: dict)`

#### Scheduler — periodic reconciliation
- Add a scheduled job: `CronTrigger(hour=1, minute=0)` — runs daily at 01:00 UTC
- Reconciles all active agents
- Sends Telegram alert if any agent has a PnL discrepancy

#### API endpoint
- `GET /agents/{id}/reconcile` — on-demand reconciliation for debugging
- Returns detailed breakdown: sum of trades, sum of uPnL, portfolio values, discrepancy

#### Web UI — reconciliation indicator
- On agent detail page, show a small checkmark or warning icon next to PnL values
- Green check = last reconciliation passed
- Yellow warning = minor discrepancy (<$1)
- Red alert = significant discrepancy (>$1)

---

### 19.7 — Telegram ↔ Site Cross-Verification Test Plan

**Manual verification checklist** (to be performed after implementation):

1. **Open trade test:**
   - Trigger a trade open on a test agent
   - Verify Telegram message shows: agent UUID, symbol, direction, entry price, position size, SL/TP
   - Navigate to agent page on site → verify same values in open positions table
   - Verify timestamps match (Telegram vs site, both in UTC)

2. **Close trade test:**
   - Wait for or trigger a trade close (agent decision, SL, or TP)
   - Verify Telegram message shows: PnL, exit price, exit reason, cumulative realized PnL
   - Navigate to agent trade history → verify same PnL, same exit price, same reason
   - Verify the leaderboard PnL updated to reflect the closed trade

3. **PnL reconciliation test:**
   - For an agent with 5+ closed trades and 1+ open position:
   - Sum all trade PnLs manually from trade history tab
   - Note the uPnL from open positions
   - Verify: Realized PnL on site = sum of trade PnLs
   - Verify: Total PnL on site = Realized PnL + uPnL
   - Verify: Telegram daily digest shows same numbers

4. **Pause test:**
   - Pause an agent with open positions
   - Verify Telegram notification sent with positions closed count
   - Verify site shows agent as paused with all positions closed
   - Verify PnL reflects the forced-close trades

5. **Discard test:**
   - Find or create an agent approaching health threshold
   - Verify auto-discard triggers
   - Verify Telegram notification with health score and reason
   - Verify site shows discarded status with timestamp and reason

---

### File Summary

| Action | File |
|--------|------|
| Create | `worker/alembic/versions/018_agent_uuid.py` |
| Modify | `worker/src/models/db.py` — Add UUID column to Agent |
| Modify | `worker/src/agents/orchestrator.py` — Pause endpoint, discard notifications |
| Modify | `worker/src/agents/portfolio.py` — Add `reconcile_pnl()`, pause force-close |
| Modify | `worker/src/notifications/templates.py` — UUID prefix, links, new message types |
| Modify | `worker/src/notifications/service.py` — New notification methods, PnL parity |
| Modify | `worker/src/main.py` — Add reconciliation scheduler job, pause/unpause routes |
| Create | `worker/src/health/routes.py` or new `worker/src/agents/routes.py` — Reconcile + pause endpoints |
| Modify | `web/src/lib/types.ts` — Add `uuid`, `realizedPnl`, `unrealizedPnl` fields |
| Modify | `web/src/lib/queries/agents.ts` — Return realized/unrealized PnL separately |
| Modify | `web/src/components/agents/agent-leaderboard.tsx` — uPnL vs realized columns |
| Modify | `web/src/components/agents/agent-overview.tsx` — Split PnL cards, absolute timestamps |
| Modify | `web/src/components/agents/agent-detail.tsx` — UUID display, pause button, timestamps |
| Modify | `web/src/components/agents/trade-history.tsx` — Absolute timestamps, openedAt column |

### Priority order
1. **19.6** — PnL reconciliation (foundational — must verify integrity first)
2. **19.1** — uPnL vs realized PnL separation (depends on correct numbers)
3. **19.4** — Timestamps on all actions (needed for audit trail)
4. **19.3** — Agent UUIDs (needed before Telegram updates)
5. **19.5** — Telegram parity (depends on UUID + correct PnL)
6. **19.2** — Paused agent behavior (depends on portfolio force-close)
7. **19.7** — Cross-verification testing (final validation of everything above)

---

## 20. LLM Cost Control — Per-Section Toggles — `COMPLETED`

**What:** Per-section toggle controls for all 6 LLM/rule call sites (trade decisions, evolution, post-mortem, memory, tweet sentiment, rule-based), with cost breakdown per section and visibility on both a new `/settings` page and read-only badges on `/status`.

**Why:** With 5 LLM call sites plus rule-based agents, there's no way to selectively disable sections to save costs during low-activity periods. This feature adds granular control over which pipeline sections run, with cost visibility to inform decisions.

**Implementation:**
- New `llm_settings` table with 6 rows (migration 019)
- Worker settings cache module — loaded once per pipeline cycle, fail-open
- All 6 call sites gated: `llm_trade_decisions`, `rule_trade_decisions`, `prompt_evolution`, `post_mortem`, `trade_memory`, `tweet_sentiment`
- Missing token tracking added to post-mortem and memory modules
- `/settings` page with toggle switches, enabled/disabled badges, and alltime + 30d cost breakdown per section
- `/status` page enhanced with read-only LLM Services panel showing enabled/disabled at a glance
- Settings nav link added

---

## 21. Progressive Pause All LLM Agents — `COMPLETED`

**What:** Replace the atomic "Pause All LLM" button with a progressive modal that pauses agents one by one, showing an ASCII spinner, progress bar, and current agent name. Includes localStorage-based resume so if something fails mid-way, the user can retry from the last successfully paused agent.

**Why:** The old approach paused all ~76 LLM agents in a single SQL query with no feedback during the operation and no way to recover if something failed. The progressive approach gives real-time visibility into what's happening and resilience against partial failures.

**Implementation:**
- New `GET /api/agents/active-llm` endpoint returns list of active LLM agent IDs and names
- New `POST /api/agents/[id]/pause` endpoint pauses a single agent by ID
- New `pauseSingleAgent()` and `getActiveLlmAgents()` query functions
- `<PauseModal>` client component with ASCII spinner animation, progress bar, and localStorage-based resume
- Leaderboard wired to open modal instead of calling bulk pause API
- Old bulk `/api/agents/pause-llm` endpoint kept as fallback

---

## 22. Client-Side Binance Price Fetching for Live uPnL — `COMPLETED`

**What:** Replace SSE-based uPnL (which required 17–30s wait for the first broadcast) with direct client-side Binance REST API price fetching. Prices load in <1s, uPnL recalculates every 5s, and per-position uPnL updates live in the positions table.

**Why:** The SSE approach only broadcast every 30s with no initial snapshot on connect, leaving users staring at a spinner for up to 30s before seeing any uPnL. Binance's public ticker API is free, fast, and CORS-friendly — fetching directly from the browser eliminates the SSE bottleneck entirely.

**Implementation:**
- `web/src/hooks/use-binance-prices.ts` — polls `api.binance.com/api/v3/ticker/price` every 5s, returns `Map<symbol, price>`
- `web/src/hooks/use-live-upnl.ts` — calculates per-position and per-agent uPnL using the same formula as the worker (LONG: `positionSize * (currentPrice - entryPrice) / entryPrice`, SHORT: inverse)
- `GET /api/positions/all` route + `getAllOpenPositions()` query — returns all open positions grouped by agent ID for the leaderboard
- `agent-detail.tsx` — SSE removed entirely, uses `useBinancePrices` + `useLiveUpnl` hooks
- `agent-overview.tsx` — positions table shows live per-position uPnL (was static DB values)
- `agent-leaderboard.tsx` — fetches all positions on mount, calculates per-agent uPnL client-side; SSE stays for non-price data (status, realized PnL, trade counts)
- `agent-row.tsx` — accepts computed `upnlValue: number | undefined` prop instead of SSE-based `liveUpnl` boolean

---

## 23. Tweet Relevance Filter (Keyword + LLM Fallback) — `COMPLETED`

**What:** Two-tier relevance filter at tweet ingestion time. Tier 1 is a free keyword/regex heuristic check (~120 crypto/trading terms). Tier 2 is a cheap Claude Haiku yes/no call for ambiguous tweets (~$0.0001/tweet). Irrelevant tweets are discarded before hitting the DB.

**Why:** Tweets from tracked accounts often include personal updates, memes, and unrelated content that clutters the feed, wastes LLM analysis cost (Haiku sentiment runs on every tweet), and degrades signal quality for the 48 tweet-based agents.

**Implementation:**
- `worker/src/twitter/filter.py` — `TweetRelevanceFilter` class with keyword matching (tickers, price patterns, ~120 trading/market/crypto terms), negative pattern detection (personal life, unrelated promos), and LLM fallback via Haiku
- `worker/alembic/versions/020_tweet_relevance_filter_setting.py` — adds `tweet_relevance_filter` row to `llm_settings` table
- `worker/src/config.py` — `tweet_filter_enabled` env var (master switch, default off)
- `worker/src/twitter/poller.py` — filter step between tweet fetch and DB persist, filter stats in poll response
- `worker/src/main.py` — `load_llm_settings()` calls in both scheduled and manual poll paths
- Two-gate design: `TWEET_FILTER_ENABLED` env var controls entire filter; `tweet_relevance_filter` DB toggle controls just the LLM fallback
- Settings page automatically shows the new toggle (no frontend changes needed)

---

## 24. Updates Feed — Product Changelog Page — `COMPLETED`

**What:** A static `/updates` page showing a chronological product changelog — what's been shipped recently. Entries are manually authored (date + title + description) and stored as a TypeScript array in the codebase.

**Why:** Alpha Board had no way to communicate new features and changes to users. The updates page gives users a simple, browsable feed of what's been shipped without requiring a CMS or database.

**Implementation:**
- `web/src/lib/data/changelog.ts` — `ChangelogEntry` type and `changelog` array with 8 seed entries covering recent features
- `web/src/components/updates/updates-list.tsx` — Server component that groups entries by month with muted uppercase section headers and bordered cards
- `web/src/app/updates/page.tsx` — Static page following the status page pattern with SEO metadata
- `web/src/components/nav-links.tsx` — Added "Updates" nav link between Status and Settings

---

## 25. Memecoins Tab — Wallet Cross-Referencing & Memecoin Twitter Intelligence — `COMPLETED`

**What:** A new top-level "Memecoins" tab that tracks real-time Solana memecoin launches (Pump.fun, PumpSwap, LetsBonk, Raydium LaunchLab), identifies smart wallets that are consistently early on winners, and powers a new fleet of memecoin-specific agents that can copy-trade those wallets on Solana.

**Why:** Memecoins on Solana are the highest-alpha, highest-risk segment of crypto. The current system tracks Binance perpetuals — adding Solana memecoins opens an entirely new asset class with different dynamics: bonding curves, graduation events, dev wallet behavior, sniper detection, and social narrative velocity. The alpha edge comes from tracking wallets that are provably early on 10x+ tokens and replicating their entries with sub-second latency.

---

### Phase 1 — Solana Infrastructure & Data Ingestion

**Goal:** Set up the foundational Solana RPC infrastructure and start ingesting new token launches from the major launchpads in real-time.

#### 1.1 — Solana RPC Provider Setup

Choose one primary provider (recommendation: **Helius** for best Solana-specific tooling):

| Provider | Why | Cost |
|----------|-----|------|
| **Helius** (recommended) | Enhanced WebSockets (1.5-2x faster than standard), LaserStream gRPC, webhooks, DAS API, excellent Pump.fun/Raydium docs | Free: 1M credits/mo. Paid: $49–$999/mo. Dedicated gRPC: $2,900/mo |
| **Shyft** | RabbitStream (shred-level, ~10ms faster than gRPC), multi-region failover, no bandwidth caps | From $1,800/mo dedicated |
| **QuickNode** | Streams, Metis Marketplace add-ons, `/new-pools` REST endpoint | Free: 10M credits/mo |

**Implementation:**
- Add Solana RPC config to `worker/src/config.py`: `SOLANA_RPC_URL`, `SOLANA_WS_URL`, `HELIUS_API_KEY`
- Install `solders` (Solana SDK for Python) and `websockets` packages
- New module: `worker/src/solana/client.py` — wraps RPC calls (getTransaction, getAccountInfo, etc.)

#### 1.2 — New Token Launch Listener

Monitor the major launchpad programs for new token creation events:

| Program | Address | Event |
|---------|---------|-------|
| Pump.fun | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | `create` instruction → new token mint |
| PumpSwap AMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | `create_pool` → token graduated to AMM |
| Raydium AMM | `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8` | `initialize2` → new liquidity pool |
| LetsBonk.fun | `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj` | Token creation on Bonk launchpad |

**Implementation:**
- New module: `worker/src/solana/launch_listener.py`
- Use Helius Enhanced WebSocket `logsSubscribe` to monitor program logs for creation events
- Parse transaction data to extract: token mint address, creator wallet, token metadata (name, symbol, image URI), initial supply, bonding curve parameters
- Alternatively, use Helius webhooks for a more reliable push-based approach
- For highest speed (copy trading phase): upgrade to Yellowstone gRPC via Helius LaserStream or Shyft

#### 1.3 — Database Schema

**Migration: `worker/alembic/versions/02X_memecoins.py`**

```sql
-- Memecoin tokens tracked
CREATE TABLE memecoin_tokens (
    id BIGSERIAL PRIMARY KEY,
    mint_address VARCHAR(64) UNIQUE NOT NULL,       -- Solana token mint address
    name VARCHAR(200),
    symbol VARCHAR(20),
    image_uri TEXT,
    creator_wallet VARCHAR(64) NOT NULL,
    launchpad VARCHAR(50) NOT NULL,                  -- 'pump_fun', 'pumpswap', 'raydium', 'letsbonk', 'believe'
    status VARCHAR(30) NOT NULL DEFAULT 'bonding',   -- 'bonding', 'graduated', 'rugged', 'dead'
    bonding_curve_progress NUMERIC(5,2),             -- 0-100%
    graduation_tx VARCHAR(128),                      -- tx signature when graduated
    created_at TIMESTAMPTZ NOT NULL,
    graduated_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'                      -- flexible: lp_burned, holder_count, etc.
);

CREATE INDEX idx_memecoin_tokens_creator ON memecoin_tokens (creator_wallet);
CREATE INDEX idx_memecoin_tokens_status ON memecoin_tokens (status);
CREATE INDEX idx_memecoin_tokens_launchpad ON memecoin_tokens (launchpad);
CREATE INDEX idx_memecoin_tokens_created ON memecoin_tokens (created_at DESC);

-- Price/volume snapshots (sampled periodically)
CREATE TABLE memecoin_snapshots (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL REFERENCES memecoin_tokens(id),
    price_sol NUMERIC(30,18),                        -- price in SOL
    price_usd NUMERIC(30,18),                        -- price in USD
    market_cap_usd NUMERIC(20,2),
    volume_24h_usd NUMERIC(20,2),
    holder_count INTEGER,
    liquidity_usd NUMERIC(20,2),
    buy_count_5m INTEGER,
    sell_count_5m INTEGER,
    snapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (snapped_at);

CREATE INDEX idx_memecoin_snapshots_token ON memecoin_snapshots (token_id, snapped_at DESC);

-- Smart wallets being tracked
CREATE TABLE smart_wallets (
    id SERIAL PRIMARY KEY,
    address VARCHAR(64) UNIQUE NOT NULL,
    label VARCHAR(100),                              -- 'sniper', 'kol', 'smart_money', 'insider', 'whale'
    category VARCHAR(50),                            -- 'top_trader', 'early_buyer', 'kol', 'fund'
    source VARCHAR(50),                              -- 'gmgn', 'birdeye', 'manual', 'discovered'
    stats JSONB DEFAULT '{}',                        -- win_rate, avg_roi, total_trades, pnl_7d, pnl_30d
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_refreshed_at TIMESTAMPTZ
);

CREATE INDEX idx_smart_wallets_category ON smart_wallets (category);

-- Activity log for tracked wallets
CREATE TABLE smart_wallet_trades (
    id BIGSERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES smart_wallets(id),
    token_id BIGINT REFERENCES memecoin_tokens(id),
    mint_address VARCHAR(64) NOT NULL,               -- in case token not yet in our DB
    direction VARCHAR(10) NOT NULL,                  -- 'buy' or 'sell'
    amount_sol NUMERIC(20,9),
    amount_tokens NUMERIC(30,0),
    price_sol NUMERIC(30,18),
    tx_signature VARCHAR(128) NOT NULL,
    block_time TIMESTAMPTZ NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    was_copied BOOLEAN DEFAULT FALSE,                -- whether our copy agent acted on this
    metadata JSONB DEFAULT '{}'                      -- slippage, pool, etc.
) PARTITION BY RANGE (block_time);

CREATE INDEX idx_sw_trades_wallet ON smart_wallet_trades (wallet_id, block_time DESC);
CREATE INDEX idx_sw_trades_token ON smart_wallet_trades (mint_address, block_time DESC);
```

#### 1.4 — Token Data Enrichment

After a new token is discovered, enrich it with data from multiple free/cheap APIs:

| Data Point | Source | Endpoint |
|------------|--------|----------|
| Price, volume, liquidity | DEXScreener (free, no auth) | `GET /latest/dex/tokens/{mintAddress}` |
| Price history (OHLCV) | Birdeye ($250/mo) | `GET /defi/price_historical?address={mint}&type=5m` |
| Holder count | Helius DAS API | `GET /v0/addresses/{mint}/balances` |
| Token metadata | Helius | `GET /v0/token-metadata?mint={address}` |
| Creator wallet history | Solscan or Helius | Previous token deployments by same wallet |
| Rug pull risk score | DeFade (free) | `defade.org` analysis |

**Implementation:**
- New module: `worker/src/solana/enricher.py` — `TokenEnricher` class
- Runs on a schedule (every 1-5 min for active tokens, hourly for older ones)
- Persists enriched data to `memecoin_snapshots` and updates `memecoin_tokens.metadata`
- Rate-limit aware: DEXScreener 300 req/min, Birdeye based on plan

---

### Phase 2 — Smart Wallet Discovery & Tracking

**Goal:** Identify wallets that are consistently early on successful memecoins, track their activity in real-time, and build a "smart money" leaderboard.

#### 2.1 — Wallet Discovery Pipeline

Three sources for discovering alpha wallets:

**Source A — GMGN.AI Wallet Rankings**
- GMGN labels wallets as: top snipers, KOLs, smart traders, insider traders
- Sortable by: 1D/7D/30D PnL, win rate, ROI
- Scrape or use GMGN API (requires volume threshold for API access, otherwise use Apify scraper)
- Filter criteria: >60% win rate over 30 days, >50 trades, >$10k realized PnL

**Source B — On-Chain Analysis (First Buyers of Winners)**
- For tokens that hit >$1M market cap:
  1. Query the first 70 buyers (from transaction history)
  2. Check each buyer's overall track record (% of tokens bought that later 10x'd)
  3. Wallets with >20% hit rate on 10x+ tokens are flagged as "smart money"
- Use Birdeye Wallet PnL API: `GET /wallet/token_performance?wallet={address}`
- Or Helius transaction history: `GET /v0/addresses/{address}/transactions`

**Source C — Dune Analytics Community Dashboards**
- Dashboard: "Solana Alpha Wallet Signals for Copy Trading"
- Query `dex_solana.bot_trades` for profitable bot wallets
- Export top performers periodically

**Implementation:**
- New module: `worker/src/solana/wallet_discovery.py` — `WalletDiscovery` class
- Scheduled job: runs daily, discovers new candidate wallets
- Scoring formula per wallet:
  ```python
  score = (win_rate * 0.3) + (avg_roi * 0.25) + (total_pnl_normalized * 0.2) + (consistency * 0.15) + (early_entry_pct * 0.1)
  ```
  Where `early_entry_pct` = % of trades where the wallet was in the first 100 buyers
- Wallets above threshold → inserted into `smart_wallets` table with stats
- Admin UI: manually add/remove wallets, adjust categories

#### 2.2 — Real-Time Wallet Monitoring

Once smart wallets are identified, monitor their on-chain activity in real-time:

**Detection Methods (ordered by latency):**

| Method | Latency | Cost | Implementation |
|--------|---------|------|----------------|
| Helius Enhanced WebSocket `transactionSubscribe` | ~200-500ms | Included in plan | Filter by wallet address, parse for DEX swap instructions |
| Helius Webhooks | ~1-3s | Included in plan | Push-based, more reliable, auto-retry |
| Yellowstone gRPC (via Helius LaserStream) | ~50-100ms | $2,900/mo dedicated | Fastest, subscribe to account changes |
| Shyft RabbitStream | ~10ms faster than gRPC | $1,800/mo | Shred-level, lowest latency possible |

**Recommended approach for MVP:** Helius Webhooks (reliable, included in standard plan)
**Recommended for production copy trading:** Yellowstone gRPC via Helius or Shyft (speed matters for frontrunning prevention)

**Implementation:**
- New module: `worker/src/solana/wallet_monitor.py` — `WalletMonitor` class
- On startup: register Helius webhooks for all active `smart_wallets` addresses
- Webhook handler endpoint: `POST /webhooks/solana/wallet-activity`
- Parse incoming transactions:
  1. Identify if it's a swap (check for Raydium, PumpSwap, Jupiter program interactions)
  2. Extract: token mint, direction (buy/sell), amount in SOL, token amount
  3. Look up or create `memecoin_tokens` entry
  4. Insert into `smart_wallet_trades`
  5. Emit event for copy trading agents (Phase 4)
- Handle webhook failures: Helius retries 3x, fallback to polling `getSignaturesForAddress` every 30s

#### 2.3 — Wallet Stats Refresh

- Scheduled job: every 6 hours, refresh stats for all active smart wallets
- Recalculate: win rate, avg ROI, PnL (7d/30d), total trades, best token, consistency score
- Use Birdeye Wallet PnL API or aggregate from `smart_wallet_trades`
- Auto-deactivate wallets that drop below performance threshold (win rate < 30% over 60 days)
- Auto-discover new wallets from recent 10x token first-buyers

---

### Phase 3 — Memecoins Dashboard (Web)

**Goal:** Build the `/memecoins` tab with three main views: Live Launches, Smart Wallets, and Agent Performance.

#### 3.1 — Navigation & Layout

- Add "Memecoins" to `nav-links.tsx` (between Tweets and Analytics, or as a top-level tab)
- Route: `web/src/app/memecoins/page.tsx`
- Three sub-tabs within the page:
  1. **Live Launches** — Real-time feed of new tokens
  2. **Smart Wallets** — Leaderboard of tracked wallets with their recent trades
  3. **Agents** — Memecoin-specific agent performance (once Phase 4 is built)

#### 3.2 — Live Launches View

A real-time feed of new Solana memecoin launches, updating via SSE.

**Table columns:**

| Column | Description |
|--------|-------------|
| Token | Name + symbol + image (from metadata) |
| Launchpad | Pump.fun / PumpSwap / Raydium / LetsBonk badge |
| Age | Time since creation (e.g., "3m ago", "2h ago") |
| Status | Bonding / Graduated / Rugged badge |
| Progress | Bonding curve fill % (visual bar, only for bonding status) |
| Price | Current price in SOL and USD |
| Mkt Cap | Current market cap in USD |
| Holders | Number of unique holders |
| Liquidity | Total liquidity in USD (post-graduation) |
| Volume 5m | Buy/sell count and volume in last 5 minutes |
| Smart $ | Number of tracked smart wallets that bought this token (with wallet labels on hover) |
| Dev | Creator wallet (truncated, clickable to Solscan) + badge if known serial deployer |

**Filters:**
- Launchpad (multi-select)
- Status (bonding / graduated / all)
- Min market cap
- Min holders
- "Smart money only" toggle — only show tokens where ≥1 smart wallet bought
- Age range (last 1h, 6h, 24h, 7d)

**Sorting:** By age (newest first default), market cap, volume, holder count, smart money count

**Real-time updates:**
- SSE endpoint: `worker/src/api/memecoins.py` → `/sse/memecoins/launches`
- Emits new token events as they're detected by the launch listener
- Client component with `useEventSource` hook

**Token detail (expandable row or click-through):**
- Price chart (5m candles from Birdeye or DEXScreener)
- Holder distribution (top 10 wallets + % held)
- Creator wallet analysis (previous launches, rug history)
- Smart wallet entries (which tracked wallets bought, when, at what price)
- Link to Solscan, DEXScreener, Birdeye for the token

#### 3.3 — Smart Wallets View

A leaderboard of tracked smart wallets with their performance metrics and recent trades.

**Wallet leaderboard columns:**

| Column | Description |
|--------|-------------|
| Wallet | Address (truncated) + label badge (sniper / KOL / smart money / whale) |
| Category | top_trader / early_buyer / kol / fund |
| Win Rate | % of token buys that were profitable (30d) |
| Avg ROI | Average return on investment per trade (30d) |
| PnL 7d | Realized PnL last 7 days (SOL + USD) |
| PnL 30d | Realized PnL last 30 days (SOL + USD) |
| Trades | Total trade count (30d) |
| Best Token | Highest ROI token in last 30 days |
| Last Active | Time since last trade |
| Source | How the wallet was discovered (GMGN / on-chain / manual) |
| Actions | Toggle copy-trading on/off (for Phase 4) |

**Wallet detail (expandable):**
- Recent trades table: token, direction, amount SOL, entry price, current price, ROI, timestamp
- Token hit rate chart: % of buys that 2x, 5x, 10x, 50x, 100x
- Activity heatmap: when is this wallet most active (hour of day / day of week)

**Admin actions:**
- Add wallet manually (paste address)
- Remove wallet
- Change category/label
- Force stats refresh

#### 3.4 — API Endpoints (Worker)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/memecoins/tokens` | GET | Paginated list of tracked tokens with filters |
| `/api/memecoins/tokens/{mint}` | GET | Single token detail with snapshots and smart wallet entries |
| `/api/memecoins/wallets` | GET | Smart wallet leaderboard with stats |
| `/api/memecoins/wallets/{address}` | GET | Single wallet detail with recent trades |
| `/api/memecoins/wallets` | POST | Add a new wallet to track (admin) |
| `/api/memecoins/wallets/{address}` | DELETE | Remove a tracked wallet (admin) |
| `/api/memecoins/stats` | GET | Aggregate stats: tokens tracked, graduated %, avg time to graduation, total smart wallet PnL |
| `/sse/memecoins/launches` | GET (SSE) | Real-time new token launch events |
| `/sse/memecoins/wallet-trades` | GET (SSE) | Real-time smart wallet trade events |
| `/webhooks/solana/wallet-activity` | POST | Helius webhook receiver for wallet transactions |

#### 3.5 — Components

| Component | File |
|-----------|------|
| `<MemecoinsPage>` | `web/src/app/memecoins/page.tsx` |
| `<LaunchesTable>` | `web/src/components/memecoins/launches-table.tsx` |
| `<LaunchRow>` | `web/src/components/memecoins/launch-row.tsx` |
| `<TokenDetail>` | `web/src/components/memecoins/token-detail.tsx` |
| `<WalletLeaderboard>` | `web/src/components/memecoins/wallet-leaderboard.tsx` |
| `<WalletRow>` | `web/src/components/memecoins/wallet-row.tsx` |
| `<WalletDetail>` | `web/src/components/memecoins/wallet-detail.tsx` |
| `<BondingCurveBar>` | `web/src/components/memecoins/bonding-curve-bar.tsx` |
| `<LaunchpadBadge>` | `web/src/components/memecoins/launchpad-badge.tsx` |
| `<SmartMoneyIndicator>` | `web/src/components/memecoins/smart-money-indicator.tsx` |

---

### Phase 4 — Memecoin Agents & Copy Trading

**Goal:** Create a fleet of memecoin-specific agents that trade on Solana, including copy-trading agents that replicate smart wallet entries.

#### 4.1 — Solana Wallet & Swap Infrastructure

Before agents can trade, we need a Solana wallet and swap execution layer:

**Wallet setup:**
- Generate or import a Solana keypair for the agent treasury
- Store encrypted private key in environment variable (`SOLANA_AGENT_PRIVATE_KEY`)
- Fund with SOL for gas fees + trading capital
- Track SOL balance as part of agent portfolio

**Swap execution via Jupiter Aggregator:**
```python
# worker/src/solana/swap.py

class JupiterSwapper:
    QUOTE_URL = "https://quote-api.jup.ag/v6/quote"
    SWAP_URL = "https://public.jupiterapi.com/swap"

    async def get_quote(self, input_mint: str, output_mint: str, amount_lamports: int, slippage_bps: int = 100):
        """Get best swap route from Jupiter."""
        params = {
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": str(amount_lamports),
            "slippageBps": slippage_bps
        }
        # Returns route with expected output, price impact, fees

    async def execute_swap(self, quote_response: dict, user_public_key: str):
        """Build, sign, and send swap transaction."""
        # 1. POST to /swap with quote + public key → get serialized tx
        # 2. Deserialize, sign with agent keypair
        # 3. Send via RPC with priority fees for faster inclusion
        # 4. Confirm transaction
        # 5. Return tx signature + actual amounts
```

**Priority fees:** Use Helius priority fee API to estimate competitive fees for fast inclusion.

**Safety guards:**
- Max position size per token (e.g., 0.5 SOL)
- Max total exposure (e.g., 10 SOL across all positions)
- Slippage protection (reject if price impact > 5%)
- Rug pull detection: check if LP is burned before buying
- Honeypot detection: simulate a sell before buying (can we actually sell this token?)

#### 4.2 — Copy Trading Agent

The highest-alpha agent type: monitors smart wallets and replicates their entries.

**Strategy:**
1. **Trigger:** Smart wallet trade detected via webhook (Phase 2.2)
2. **Filter:** Only copy BUY signals (ignore sells initially). Only copy if:
   - Wallet win rate > 50%
   - Token has > 10 holders
   - Token age > 2 minutes (avoid honeypots)
   - No more than 30% of supply held by top wallet (rug risk)
   - LP is burned or locked
3. **Size:** Position size proportional to wallet confidence score:
   - Top-tier wallets (>70% win rate): 0.3 SOL
   - Mid-tier (50-70% win rate): 0.15 SOL
   - Configurable per wallet via `smart_wallets.metadata`
4. **Exit rules:**
   - Take profit at 2x, 5x, 10x (partial exits: sell 30% at 2x, 30% at 5x, remaining at 10x)
   - Stop loss at -50% (memecoins are volatile, tight stops get chopped)
   - Time-based exit: sell if no 2x within 24 hours
   - Copy the smart wallet's sell (if the tracked wallet sells, we sell too)
5. **Latency target:** < 2 seconds from smart wallet tx confirmation to our swap submission

**Implementation:**
- New agent source: `source = 'memecoin'` in agents table
- New archetype: `copy_trader`
- Engine: `rule` (no LLM needed — speed is critical, decisions are mechanical)
- New module: `worker/src/solana/copy_agent.py` — `CopyTradingAgent` class
- Listens to `smart_wallet_trades` events from wallet monitor
- Executes via `JupiterSwapper`
- Logs trades to `agent_trades` (same schema, with `exit_reason` values like `copy_sell`, `take_profit_2x`, `stop_loss`, `time_exit`)

#### 4.3 — Memecoin-Native Agent Archetypes

Beyond copy trading, create agents that use on-chain signals:

| Archetype | Strategy | Engine |
|-----------|----------|--------|
| `memecoin_sniper` | Buy tokens within 60s of launch if creator wallet has track record + bonding curve filling fast | Rule |
| `memecoin_graduation` | Buy tokens approaching graduation (>80% bonding curve progress) before they migrate to AMM (graduation pump) | Rule |
| `memecoin_momentum` | Buy tokens with accelerating volume and smart wallet accumulation; ride momentum with trailing stop | Rule + LLM |
| `memecoin_contrarian` | Fade tokens that dumped >70% from ATH but still have strong holder base and smart wallet holding | LLM |
| `copy_trader` | Replicate smart wallet entries with configurable filters and exit rules (described above) | Rule |

**Agent fleet:**
- 5 archetypes × 1 engine (rule for speed-sensitive, LLM for analysis-heavy) = 5-10 agents initially
- No timeframe dimension (memecoins are event-driven, not candle-driven)
- Separate portfolio with SOL denomination (not USDT like Binance agents)

#### 4.4 — Portfolio Management (SOL-denominated)

Extend `PortfolioManager` for Solana:
- Track balances in SOL (not USDT)
- Track actual on-chain positions (token balances in wallet)
- Reconcile DB state with on-chain balances periodically
- Compute PnL in both SOL and USD terms
- Handle gas fees as trading costs

**Database changes:**
- Add `denomination` column to `agent_portfolios` (`USDT` or `SOL`)
- Add `chain` column to agents table (`binance` or `solana`)
- Add `gas_fees_paid` to `agent_trades` for Solana trades

#### 4.5 — Telegram Notifications

New notification templates for memecoin events:
- **New smart wallet entry:** "[SMART $] 🔵 Wallet `abc...xyz` (72% WR) bought 0.5 SOL of $TOKENNAME — 3m old, 42 holders, $12k mcap"
- **Copy trade executed:** "[COPY] Copied wallet `abc...xyz` → bought 0.15 SOL of $TOKENNAME at $0.00023 — watching for 2x"
- **Copy trade exit:** "[COPY] Sold $TOKENNAME → +3.2x (0.48 SOL profit) — exit: take_profit_5x"
- **Daily memecoin digest:** Tokens tracked, copy trades made, total PnL, best/worst trade, active positions

---

### Phase 5 — Alpha Signals & Analytics

**Goal:** Surface actionable alpha signals from the data collected in Phases 1-4.

#### 5.1 — Alpha Signal Detection

Automated detection of high-conviction signals:

| Signal | Description | Detection Method |
|--------|-------------|-----------------|
| **Smart Money Convergence** | 3+ tracked wallets buy the same token within 10 minutes | Aggregate `smart_wallet_trades` by token, window = 10min |
| **Serial Dev Launch** | Creator wallet has launched 2+ tokens that hit >$100k mcap | Join `memecoin_tokens.creator_wallet` with historical success rate |
| **Graduation Imminent** | Bonding curve > 85% filled, accelerating | Monitor `bonding_curve_progress` rate of change |
| **Volume Spike** | 5-minute volume > 10x the token's average | Compare current `volume_5m` to rolling average |
| **KOL Mention** | Known crypto influencer tweeted about a token (cross-reference with tweet_signals) | Match `tweets.symbols_mentioned` with `memecoin_tokens.symbol` |
| **Bundle/Sniper Alert** | >30% of supply acquired by bundled transactions in first block | Parse early transactions for bundled buy patterns |

**Implementation:**
- New module: `worker/src/solana/signals.py` — `AlphaSignalDetector` class
- Runs every 1-2 minutes on active tokens
- Stores detected signals in `memecoin_signals` table (token_id, signal_type, confidence, metadata, detected_at)
- Feeds into agent context for LLM-based memecoin agents
- Emits via SSE for dashboard real-time display

#### 5.2 — Dashboard Analytics (Memecoins Sub-tab)

Add analytics specific to the memecoin vertical:

- **Token Funnel:** How many tokens launched → graduated → hit $100k → hit $1M → sustained
- **Smart Wallet Leaderboard:** Ranked by ROI, win rate, consistency
- **Copy Trade Performance:** Equity curve, win rate, avg multiplier, best/worst trade
- **Signal Backtesting:** Historical hit rate per signal type (e.g., "Smart Money Convergence" signals led to 2x+ returns 34% of the time)
- **Launchpad Comparison:** Success rate by launchpad (% of tokens that graduate, avg time to graduation, avg max market cap)

---

### Phase 6 — Risk Management & Safety

**Goal:** Prevent catastrophic losses from rug pulls, honeypots, and market manipulation.

#### 6.1 — Pre-Trade Safety Checks

Before any agent executes a buy:

| Check | Method | Block if |
|-------|--------|----------|
| **Honeypot detection** | Simulate a sell transaction via Jupiter | Sell simulation fails or >50% price impact |
| **LP burn verification** | Check if LP tokens are burned (not held by dev) | LP tokens held by creator wallet |
| **Holder concentration** | Check top 10 wallet balances | Any single wallet holds >20% of supply |
| **Token age** | Check `created_at` timestamp | Token < 2 minutes old (avoid sandwich attacks) |
| **Dev wallet history** | Check creator's previous token launches | >50% of previous launches rugged |
| **Mint authority** | Check if mint authority is revoked | Mint authority still active (can inflate supply) |

**Implementation:**
- New module: `worker/src/solana/safety.py` — `SafetyChecker` class
- Called by all memecoin agents before executing any buy
- Returns `(is_safe: bool, risk_score: float, warnings: list[str])`
- Log all safety check results for post-hoc analysis

#### 6.2 — Portfolio-Level Risk Limits

| Limit | Default | Configurable |
|-------|---------|:---:|
| Max single position size | 0.5 SOL | Yes |
| Max total memecoin exposure | 10 SOL | Yes |
| Max concurrent positions | 20 | Yes |
| Max loss per day | 3 SOL | Yes |
| Max loss per week | 10 SOL | Yes |
| Circuit breaker: pause all agents if | Weekly loss > 50% of capital | Yes |

---

### Implementation Priority

| Phase | Dependencies | Effort | Alpha Value |
|-------|-------------|--------|-------------|
| **Phase 1** — Infra & ingestion | None | High (RPC setup, schema, listeners) | Low (data only) |
| **Phase 2** — Smart wallet discovery | Phase 1 | Medium | Medium (intelligence layer) |
| **Phase 3** — Dashboard | Phase 1, 2 | Medium | Medium (visibility) |
| **Phase 4** — Agents & copy trading | Phase 1, 2 | High (swap infra, real money) | **Very High** (actual alpha) |
| **Phase 5** — Signals & analytics | Phase 1-4 | Medium | High (signal refinement) |
| **Phase 6** — Safety | Phase 4 | Medium | **Critical** (loss prevention) |

**Recommended order:** Phase 1 → Phase 2 → Phase 6 (safety before trading) → Phase 4 → Phase 3 → Phase 5

---

### Cost Estimates

#### Solana RPC Provider (pick one)

| Provider | Plan | Price/mo | Credits/mo | RPC RPS | gRPC Mainnet | Enhanced WS | Webhooks |
|----------|------|----------|-----------|---------|:---:|:---:|:---:|
| **Helius** | Free | $0 | 1M | 10 | No | No | Yes |
| **Helius** | Developer | $49 | 10M | 50 | No | No | Yes |
| **Helius** | Business | $499 | 100M | 200 | No | Yes | Yes |
| **Helius** | Professional | $999 | 200M | 500 | Yes (LaserStream) | Yes | Yes |
| **Helius** | Dedicated Node | $2,900+ | Custom | Custom | Yes | Yes | Yes |
| **Shyft** | Build | $199 | Unlimited | 100 | Yes + RabbitStream | N/A | N/A |
| **Shyft** | Grow | $349 | Unlimited | 150 | Yes + RabbitStream | N/A | N/A |
| **Shyft** | Accelerate | $649 | Unlimited | 400 | Yes + RabbitStream | N/A | N/A |
| **Shyft** | Dedicated gRPC | $1,800+ | Unlimited | Custom | Yes (shred-level) | N/A | N/A |
| **QuickNode** | Free Trial | $0 | 10M | 15 | Metered | N/A | 1 webhook |
| **QuickNode** | Build | $49 | 80M | 50 | Metered | N/A | 5 webhooks |
| **QuickNode** | Scale | $499 | 950M | 250 | Metered | N/A | 20 webhooks |

Helius overage: $5 per 1M credits. QuickNode overage: ~$0.55/1M credits. Shyft: no overages (unlimited).

**Recommendation by phase:**
- **Phase 1-2 (data ingestion, no trading):** Helius Developer at **$49/mo** — 10M credits, webhooks for wallet monitoring, WebSockets for launch detection.
- **Phase 4 MVP (copy trading, paper):** Helius Developer still sufficient.
- **Phase 4 production (real copy trading):** Upgrade to Helius Professional at **$999/mo** for LaserStream gRPC (~50-100ms latency) or Shyft Build at **$199/mo** for RabbitStream gRPC (~10ms faster than standard gRPC, unlimited credits).

#### Token & DEX Data APIs

| Provider | Plan | Price/mo | What You Get | Rate Limit |
|----------|------|----------|-------------|------------|
| **DEXScreener** | Free | $0 | Token price, pairs, volume, liquidity. No auth needed. | 60 req/min |
| **Birdeye (BDS)** | Lite | $39 | Token price, OHLCV, trades, wallet portfolio/history | 15 RPS, 1.5M CUs |
| **Birdeye (BDS)** | Premium Plus | $250 | Everything in Lite + WebSocket (500 connections), higher CUs | 50 RPS, 20M CUs |
| **Birdeye (BDS)** | Business | $699 | Everything + batch APIs, 2000 WS connections | 100 RPS, 100M CUs |
| **Bitquery** | Developer (Free) | $0 | GraphQL API trial, 2 active streams, 10 rows/req | 10 req/min, 1K points |
| **Bitquery** | Commercial | Contact sales | Full streaming, Kafka, SQL exports | Custom |

Birdeye overage: Lite $23/1M CUs, Premium Plus $9.9/1M CUs, Business $6.9/1M CUs.

**Recommendation:** Start with **DEXScreener (free)** for token price/volume data. Add **Birdeye Lite ($39/mo)** when wallet PnL tracking is needed (Phase 2). Upgrade to **Birdeye Premium Plus ($250/mo)** only if WebSocket real-time data is required.

#### Wallet Intelligence & Tracking

| Provider | Plan | Price/mo | Solana Wallets | Key Features |
|----------|------|----------|---------------|-------------|
| **Cielo** | Free | $0 | 50 | Wallet profiles, PnL, trading, 120 alerts/hr, 1 TG bot |
| **Cielo** | Pro | $59 | 200 | Wallet Discovery dashboard, 1000 alerts/hr, 4 TG bots |
| **Cielo** | Whale | $199 | 1,000 | Full API access, 3000 alerts/hr, 18 TG bots |
| **Nansen** | Free | $0 | N/A | Basic analytics, AI search, wallet/entity analytics |
| **Nansen** | Pro | $69 (monthly) / $49 (annual) | N/A | 300M+ labeled addresses, Smart Money filters, PnL, alerts |
| **GMGN** | N/A | N/A | N/A | **No public API.** IP whitelist for active traders only. 2 req/s. Unstable/unofficial. |

**Recommendation:** Start with **Cielo Free (50 wallets)** for MVP smart wallet tracking. Upgrade to **Cielo Pro ($59/mo)** for Wallet Discovery dashboard (200 wallets). Add **Nansen Pro ($49-69/mo)** for labeled wallet intelligence if manual discovery isn't enough.

#### Swap Execution

| Provider | Price | Fee Model | Notes |
|----------|-------|-----------|-------|
| **Jupiter Ultra API** | Free | 5-10 bps per swap (0.05-0.10%) | RPC-less, handles everything. 50-400ms landing via Jupiter Beam. Recommended. |
| **Jupiter Metis API** | Free | No swap fee | Requires your own RPC. More control, more complexity. |
| **Solana base tx fee** | 0.000005 SOL (~$0.001) | Per signature | Always charged |
| **Solana priority fee** | Variable | Per compute unit | Low: ~$0.002, Medium: ~$0.005, High: ~$0.009 per 200K CU tx |
| **Jito tip (MEV protection)** | 0.0001-0.001 SOL | Per tx | Optional. Prevents sandwich attacks. $0.02-$0.20 at current SOL price. |

**Estimated per-trade cost:** $0.003-$0.03 in gas/priority fees + 5-10 bps Jupiter fee on swap value.
**At 50 copy trades/day:** ~$0.15-$1.50/day in gas = **$5-45/mo** in transaction fees.

#### Total Cost Scenarios

**Scenario A — MVP (Data collection + paper trading, no real money)**

| Service | Plan | Cost/mo |
|---------|------|---------|
| Helius | Developer | $49 |
| DEXScreener | Free | $0 |
| Cielo | Free | $0 |
| Jupiter | Free (no real trades) | $0 |
| **Total** | | **$49/mo** |

**Scenario B — Production (Smart wallet tracking + copy trading)**

| Service | Plan | Cost/mo |
|---------|------|---------|
| Helius | Developer | $49 |
| Birdeye | Lite | $39 |
| Cielo | Pro | $59 |
| DEXScreener | Free | $0 |
| Jupiter swap fees | ~50 trades/day | ~$15-30 |
| Solana gas fees | ~50 txs/day | ~$5-15 |
| **Total** | | **$167-192/mo** |

**Scenario C — Full Alpha (Low-latency gRPC + full intelligence stack)**

| Service | Plan | Cost/mo |
|---------|------|---------|
| Shyft | Build (gRPC + RabbitStream) | $199 |
| Birdeye | Premium Plus (WebSocket) | $250 |
| Cielo | Whale (API + 1000 wallets) | $199 |
| Nansen | Pro (labeled addresses) | $49 |
| DEXScreener | Free | $0 |
| Jupiter swap fees | ~100 trades/day | ~$30-60 |
| Solana gas + Jito tips | ~100 txs/day | ~$30-90 |
| **Total** | | **$757-847/mo** |

**Scenario D — Maximum Speed (Dedicated gRPC for sub-50ms copy trading)**

| Service | Plan | Cost/mo |
|---------|------|---------|
| Helius | Dedicated Node | $2,900 |
| Birdeye | Business | $699 |
| Cielo | Whale | $199 |
| Nansen | Pro | $49 |
| Jupiter + gas + Jito | ~200 trades/day | ~$100-200 |
| **Total** | | **$3,947-4,047/mo** |

---

### File Summary

| Component | Location |
|-----------|----------|
| Migration (4 tables) | `worker/alembic/versions/02X_memecoins.py` |
| Solana RPC client | `worker/src/solana/client.py` |
| Launch listener | `worker/src/solana/launch_listener.py` |
| Token enricher | `worker/src/solana/enricher.py` |
| Wallet discovery | `worker/src/solana/wallet_discovery.py` |
| Wallet monitor | `worker/src/solana/wallet_monitor.py` |
| Jupiter swapper | `worker/src/solana/swap.py` |
| Copy trading agent | `worker/src/solana/copy_agent.py` |
| Alpha signal detector | `worker/src/solana/signals.py` |
| Safety checker | `worker/src/solana/safety.py` |
| Memecoin API routes | `worker/src/api/memecoins.py` |
| Webhook handler | `worker/src/api/webhooks.py` |
| Memecoins page | `web/src/app/memecoins/page.tsx` |
| Launches table | `web/src/components/memecoins/launches-table.tsx` |
| Wallet leaderboard | `web/src/components/memecoins/wallet-leaderboard.tsx` |
| Token detail | `web/src/components/memecoins/token-detail.tsx` |
| Nav link | `web/src/components/nav-links.tsx` |

### Key Technical Decisions to Make Before Starting

1. **Helius vs Shyft vs QuickNode** — Primary Solana RPC provider. Helius recommended for best docs and Pump.fun-specific tooling.
2. **Webhook vs WebSocket vs gRPC** — For wallet monitoring. Webhooks for MVP (simpler), gRPC for production copy trading (faster).
3. **Real money vs paper trading** — Start with paper trading (simulated swaps, no on-chain execution) to validate strategies before risking capital.
4. **Birdeye vs free alternatives** — Birdeye at $250/mo provides the best wallet PnL data. Alternative: aggregate from on-chain transactions (free but more complex).
5. **Dedicated gRPC node** — Only needed if copy trading latency under 100ms is critical. Start without, upgrade if strategies prove profitable.

---

## Memecoins Section — UX Improvements — `COMPLETED`

### Always-Visible VIP/Delete Buttons + Confirmation — `COMPLETED`
VIP star and delete buttons on account pills are now always visible (no hover required). Delete shows inline "Delete? Yes / No" confirmation.

### Trade Feed Visibility Fix — `COMPLETED`
Added missing `--text-tertiary` CSS variable. Trade sidebar text bumped to `--text-muted` for readability.

### Token Detail Modal — `COMPLETED`
Clicking a trending token opens a modal showing all accounts that mentioned it, with category badges, VIP indicators, and tweet snippets.

### Account Profile Modal — `COMPLETED`
Clicking an account pill opens a modal with call history: tokens mentioned, first-mention date, match-time mcap, ATH mcap, and color-coded multiplier.

### Smart Token Detection (CA + URL Extraction) — `COMPLETED`
Two-phase token extraction: Phase 1 resolves contract addresses from DexScreener/Birdeye/Pump.fun URLs and raw CAs. Phase 2 falls back to symbol search, skipping symbols already resolved via Phase 1. Fixes the $CTO collision problem.

---

## React Doctor: Remaining Improvements — `PENDING`

**What:** Address the remaining react-doctor findings (score 91/100 → target 97+). These require architectural changes or new dependencies.

**Current score:** 91/100 — 14 errors, 21 warnings across 10 files.

### Errors

**1. Replace fetch-in-useEffect with react-query or SWR (4 instances)**
- `agent-leaderboard.tsx` — positions polling (line 153) and symbol search (line 212)
- `trade-notification-provider.tsx` — exchange settings fetch (line 83)
- `pause-modal.tsx` — active agents fetch (line 56)

Install `@tanstack/react-query`, wrap app in `QueryClientProvider`, convert each `useEffect(fetch)` to `useQuery()`.

**2. Fix "value blocks in try/catch" for React Compiler (5 instances)**
- `exchange-settings.tsx:40` — conditional logic inside try block
- `account-manager.tsx:129` — conditional logic inside try block
- `memecoin-account-manager.tsx:146` — conditional logic inside try block
- `pause-modal.tsx:105, 115` — conditional logic inside try blocks

Extract conditional expressions (`if (!res.ok)`, ternaries, optional chaining) out of try blocks into separate variables or helper functions so the compiler can optimize them.

**3. Eliminate setState-in-useEffect for hydration sync (5 instances)**
- `exchange-settings.tsx:52` — `fetchSettings` called in effect
- `agent-leaderboard.tsx:116, 216` — SSE data sync + symbol search debounce
- `trade-notification-provider.tsx:97` — localStorage sidebar state
- `logo-switcher.tsx:33` — mounted state

Use `useSyncExternalStore` for localStorage reads. Convert data fetching effects to react-query. For SSE sync, consider deriving state during render instead of syncing via effects.

### Warnings

**4. Consolidate useState calls with useReducer (7 components)**
- `model-config.tsx`, `exchange-settings.tsx`, `account-manager.tsx`, `agent-leaderboard.tsx`, `memecoin-account-manager.tsx`, `trade-notification-provider.tsx`, `pause-modal.tsx`

Group related state (e.g. form fields, loading/error/result) into `useReducer` to reduce re-render overhead and improve readability.

**5. Break large components into focused sub-components (4 components)**
- `exchange-settings.tsx` (325 lines)
- `agent-leaderboard.tsx` (600+ lines)
- `memecoin-account-manager.tsx` (500+ lines)
- `pause-modal.tsx` (390 lines)

Extract logical sections (filters, table, modals) into separate components.

**6. Use next/image instead of img (1 instance)**
- `logo-switcher.tsx:45` — Replace `<img>` with `next/image` for automatic WebP/AVIF, lazy loading, and responsive srcset.

**7. useState-from-props pattern (6 instances)**
- `discarded-agents.tsx`, `account-manager.tsx`, `agent-leaderboard.tsx`, `memecoin-account-manager.tsx`, `trade-notification-provider.tsx`, `rankings-table.tsx`

These are intentional (local mutation of server-fetched initial data). Consider adding `// eslint-disable-next-line` comments or refactoring to derive state during render where possible.
