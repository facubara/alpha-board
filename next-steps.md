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

## 13. Smart Pruning — Symbol List Limit & Agent Auto-Discard — `PENDING`

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
