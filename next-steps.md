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

## 7. Caching Layer (Redis) — `PENDING`

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

## 9. Twitter Feed Integration & Tweet-Driven Agents — `PENDING`

**What:** Connect to the Twitter API to ingest real-time tweets from a configurable list of accounts, extract sentiment/setups, and feed that context into two new agent tiers: **tweet-only agents** (trade purely on tweet signals) and **hybrid agents** (existing technical analysis + tweet context).

**Why:** On-chain and technical signals miss the narrative layer — influential accounts (analysts, founders, insiders) often move markets before indicators catch up. Adding tweet intelligence gives agents an information edge and lets us measure whether social signals improve or hurt performance vs. pure technicals.

**Implementation notes:**

### Phase 1 — Twitter Ingestion Pipeline
- Integrate with the **Twitter API v2** (Filtered Stream or polling via search/recent, depending on tier purchased).
- New `twitter_accounts` table: `id`, `handle`, `display_name`, `category` (analyst, founder, news, degen, etc.), `active`, `added_at`.
- New `tweets` table: `id`, `twitter_account_id`, `tweet_id`, `text`, `created_at`, `metrics` (likes, RTs, quotes), `ingested_at`.
- Admin UI on the web dashboard to **add/remove tracked accounts** — simple CRUD backed by a POST `/api/twitter/accounts` route (auth-protected).
- Worker module `worker/src/twitter/` with a streaming listener (or scheduled poller) that persists incoming tweets and broadcasts via SSE.

### Phase 2 — Sentiment & Setup Extraction
- **Multi-provider LLM analysis**: Use Claude by default but make the sentiment model **toggleable** between providers (Claude, OpenAI, Gemini, etc.) via a new `llm_provider` config on the agent or a global setting.
- Abstract the current Anthropic-only executor into a **provider-agnostic LLM client** (`worker/src/llm/`) with adapters per provider, each exposing the same `analyze(prompt, context) → structured_output` interface.
- For each tweet batch, run a sentiment/setup extraction pass that produces: `sentiment` (bullish/bearish/neutral, -1 to +1), `mentioned_symbols[]`, `setup_type` (call, analysis, news, rumor), `confidence`, `raw_reasoning`.
- Store results in a `tweet_signals` table linked to the tweet and any matched symbols.
- Expose a `TweetContext` dataclass (recent signals per symbol, account credibility, signal consensus) that agents can consume.

### Phase 3 — Tweet-Only Agents
- New agent class: **tweet-only** — trades purely on tweet signals without technical indicators.
- Create agents across **all 6 timeframes** (15m, 30m, 1h, 4h, 1d, 1w) — the timeframe determines how long the agent holds positions and how far back it looks at tweet history.
- Archetypes: `tweet_momentum` (ride hype), `tweet_contrarian` (fade overreaction), `tweet_narrative` (follow macro thesis), `tweet_insider` (weight founder/insider accounts higher).
- Each archetype runs as both `llm` and `rule` engine, mirroring existing convention.
- 4 archetypes × 6 timeframes × 2 engines = **48 tweet-only agents**.

### Phase 4 — Hybrid Agents (Technical + Tweets)
- Duplicate all **28 existing agents** with a hybrid variant that receives `TweetContext` alongside the existing `RankingsContext`.
- The hybrid prompt injects tweet sentiment, recent mentions, and setup signals for the symbols the agent is considering.
- Tag hybrid agents with `source: hybrid` (vs. `source: technical` for originals and `source: tweet` for tweet-only) so analytics can compare performance across signal sources.
- 28 hybrid agents total.

### Phase 5 — Dashboard & Analytics
- New `/tweets` page showing the live tweet feed, sentiment timeline, and account list management.
- Extend the analytics dashboard with a **signal source comparison** view: technical vs. tweet-only vs. hybrid PnL, win rate, and drawdown.
- On agent detail pages, show which tweets influenced each decision (link `agent_decisions` → `tweet_signals`).
- Filter agents by source type on the leaderboard.

### Summary — New Agent Count
| Source | Agents |
|--------|--------|
| Existing (technical) | 28 |
| Tweet-only (4 archetypes × 6 TFs × 2 engines) | 48 |
| Hybrid (mirror of existing 28 + tweet context) | 28 |
| **Total** | **104** |

---

## 10. Consensus Ticker Banner — `PENDING`

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

## 11. Chart & KPI Visual Fixes (Analytics + Agents) — `PENDING`

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

## 12. Rankings Table — Price/Volume Variation & Funding Rate — `PENDING`

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

## 14. Database Provider Evaluation Report — `PENDING`

**What:** A comprehensive evaluation of database providers (Postgres-compatible and otherwise) to inform whether Alpha Board should stay on Neon or migrate — and if so, where.

**Why:** The project runs on **Neon Postgres (free tier)** shared between the worker (Fly.io, Amsterdam) and the web app (Vercel, US-East). As the system scales from 28 to 104 agents (feature #9) and data accumulates, the 0.5 GiB free-tier ceiling and cross-region latency will become constraints. This report documents the tradeoffs so the decision is informed, not reactive.

---

### A. Current State Baseline

**Infrastructure:**
- **Worker** (Fly.io `ams`) → `psycopg3` async TCP connection pool (`pool_size=5`, `max_overflow=10`) → Neon Postgres
- **Web** (Vercel `iad1`) → `@neondatabase/serverless` HTTP driver → Neon Postgres
- **Database** — Neon Postgres free tier, single region

**Neon free tier limits:**
- 0.5 GiB storage
- 100 compute-hours/month (0.25 CU)
- 20 projects
- Scale-to-zero after 5 minutes of inactivity (cold start ~500ms)

**Cross-region latency concern:**
- Worker in Amsterdam (AMS) → Neon (likely EU) = low latency for writes
- Web in US-East (IAD1) → Neon (EU) = ~80–120ms per query round-trip
- All 4 web query files (`rankings.ts`, `agents.ts`, `analytics.ts`, `backtest.ts`) hit the DB on every page load via server components

**Postgres feature hard requirements — 8 features the codebase depends on:**

| # | Feature | Where Used |
|---|---------|------------|
| 1 | `RANGE` partitioning | `snapshots`, `agent_decisions` tables — partition by date for retention/performance |
| 2 | `JSONB` columns | 11 columns across 16 ORM models (`indicator_signals`, `metrics`, `config`, etc.) |
| 3 | Advisory locks (`pg_advisory_xact_lock`) | `worker/src/pipeline/runner.py` — prevents concurrent pipeline runs |
| 4 | `ON CONFLICT ... DO UPDATE` (upserts) | `runner.py`, `orchestrator.py` — idempotent snapshot and decision writes |
| 5 | `gen_random_uuid()` | Default UUIDs on multiple tables |
| 6 | Partial indexes (`CREATE INDEX ... WHERE`) | Indexes on `status = 'open'` positions, `is_active = true` agents |
| 7 | `FILTER(WHERE)` aggregates | Analytics queries — `SUM(pnl) FILTER (WHERE direction = 'LONG')` etc. |
| 8 | `INTERVAL` arithmetic | Retention policies, time-windowed queries (`NOW() - INTERVAL '30 days'`) |

Any provider that doesn't support **all 8** requires code/schema changes proportional to the gap.

---

### B. Provider-by-Provider Evaluation

#### Tier 1 — Postgres-Compatible (Drop-in Migration)

**1. Neon (current)**
- **Free tier:** 0.5 GiB storage, 100 CU-hours/month, 20 projects
- **Paid:** $19/mo (Pro) — 10 GiB storage, 300 CU-hours, branching
- **Strengths:** Native serverless HTTP driver for Vercel (`@neondatabase/serverless`), scale-to-zero, database branching for dev/test, Postgres 16+, all 8 features supported
- **Weaknesses:** 0.5 GiB ceiling is tight as data grows (28 agents × 6 timeframes × 200+ symbols × daily partitions), cold starts after scale-to-zero (~500ms first query)
- **Migration effort:** None (current provider)

**2. Supabase**
- **Free tier:** 500 MB storage, 2 projects, pauses after 7 days of inactivity
- **Paid:** $25/mo (Pro) — 8 GiB storage, no pause, daily backups
- **Strengths:** Full Postgres (14/15), Supavisor connection pooler (PgBouncer-compatible), built-in Auth/Storage/Realtime if needed later, good dashboard, all 8 features supported
- **Weaknesses:** Free tier pauses after 7 days idle (problematic if worker goes down), paying $25/mo includes Auth/Storage/Realtime we don't use, no native serverless HTTP driver (need `postgres.js` or `pg` on the web side)
- **Migration effort:** Tier 1 — swap connection string + replace Neon driver with `postgres` (postgres.js) in `web/src/lib/db.ts`

**3. Railway**
- **Free tier:** None (one-time $5 trial credit)
- **Paid:** $5/mo subscription + usage-based (~$0.000231/hr CPU, $0.000231/GB-hr memory, $0.25/GB storage)
- **Strengths:** Extremely cheap at low scale (~$0.55/mo for a small Postgres DB with minimal usage), simple deploy, good DX, Postgres 15+, all 8 features supported
- **Weaknesses:** No persistent free tier, no built-in connection pooler (need external PgBouncer or app-side pooling), no serverless HTTP driver, pricing becomes less competitive at scale
- **Migration effort:** Tier 1 — swap connection string + replace Neon driver in `web/src/lib/db.ts`

**4. Render**
- **Free tier:** 1 GB storage, expires after 30 days (then deleted)
- **Paid:** ~$7/mo (Starter) — 1 GB, daily backups
- **Strengths:** Simple setup, Postgres 15+, all 8 features supported, good for quick prototyping
- **Weaknesses:** Free tier DB is deleted after 30 days (not viable for production), no connection pooler, no serverless driver, limited region options
- **Migration effort:** Tier 1 — swap connection string + replace Neon driver in `web/src/lib/db.ts`

**5. Fly.io Postgres**
- **Free tier:** N/A — self-managed Postgres on Fly machines (~$2–7/mo depending on VM size)
- **Paid:** ~$2/mo (shared-cpu-1x, 256MB) to ~$7/mo (shared-cpu-1x, 1GB) + $0.15/GB storage
- **Strengths:** Co-located with the worker in AMS (sub-1ms latency for writes), full Postgres 16, all 8 features supported, cheapest option for a dedicated instance
- **Weaknesses:** Self-managed — no automatic backups, no failover, no monitoring dashboard (must set up yourself), web in IAD1 would have ~80–100ms latency to AMS, Fly's Postgres is "not a managed service" (their own words)
- **Migration effort:** Tier 2 — swap connection string + replace Neon driver + set up backup cron, monitoring, and upgrade procedures yourself

**6. Aiven**
- **Free tier:** 1 GB storage, single-node, indefinite (no pause/expiry)
- **Paid:** $5/mo (Hobbyist) — 4 GB, daily backups
- **Strengths:** Free tier doesn't expire or pause, PgBouncer included, Postgres 15+, all 8 features supported, good managed experience
- **Weaknesses:** Limited region selection on free tier (may not have AMS or IAD1), single-node free tier (no HA), 1 GB cap on free tier
- **Migration effort:** Tier 1 — swap connection string + replace Neon driver in `web/src/lib/db.ts`

**7. AWS RDS**
- **Free tier:** 750 hours db.t3.micro + 20 GB storage (12 months only)
- **Paid:** ~$15/mo (db.t3.micro on-demand after free tier) + storage
- **Strengths:** US-East-1 co-located with Vercel (fast web reads), battle-tested, Postgres 15/16, all 8 features supported, automatic backups, Multi-AZ option
- **Weaknesses:** 12-month free tier limit (then ~$15/mo+), AWS console complexity, needs RDS Proxy for serverless/pooling ($$$), worker in AMS would have ~80–100ms write latency
- **Migration effort:** Tier 1 — swap connection string + replace Neon driver + configure security groups/VPC

**8. Tembo**
- **Free tier:** Yes (limited resources, single instance)
- **Paid:** TBD (newer provider, pricing evolving)
- **Strengths:** Rich extensions ecosystem out of the box (`pg_partman`, `pg_cron`, `pgvector`), Postgres 15+, all 8 features supported, Kubernetes-based
- **Weaknesses:** Newer provider (less battle-tested), smaller community, pricing/limits not fully settled, fewer regions
- **Migration effort:** Tier 1 — swap connection string + replace Neon driver in `web/src/lib/db.ts`

#### Tier 3 — Non-Postgres (Major Rewrite Required)

**9. CockroachDB (Serverless)**
- **Free tier:** 5 GiB storage, 50M request units/month
- **Why not viable:** No `RANGE` partitioning (uses hash-sharding), no `pg_advisory_xact_lock` (advisory locks not supported). Would require removing partitioning DDL and replacing advisory locks with distributed locking — moderate rewrite (~2–3 days).
- **Missing features:** #1 (RANGE partitioning), #3 (advisory locks)

**10. Turso (libSQL/SQLite)**
- **Free tier:** 5 GB storage, 500M rows read/month, edge replicas
- **Why not viable:** SQLite-based — no JSONB (uses JSON1 with different syntax), no partitioning, no advisory locks, no `Numeric` precision type, no `FILTER(WHERE)` aggregates. Full schema and query rewrite required — not practical.
- **Missing features:** #1, #2, #3, #5, #6, #7

**11. PlanetScale (MySQL-compatible)**
- **Free tier:** Removed in April 2024
- **Why not viable:** MySQL dialect — different SQL syntax, no Postgres-specific features. Would require rewriting every query, model, and migration. Full rewrite with no free tier.
- **Missing features:** All 8 (different dialect entirely)

---

### C. Comparison Matrix

| Provider | Type | PG Version | Free Tier | Paid Start | Pooler | Serverless Driver | Partitioning | JSONB | Advisory Locks | Upserts | UUID | Partial Idx | FILTER | INTERVAL | Near AMS | Near IAD1 | Migration Tier |
|----------|------|------------|-----------|------------|--------|-------------------|-------------|-------|----------------|---------|------|-------------|--------|----------|----------|-----------|----------------|
| **Neon** | Managed PG | 16 | 0.5 GiB | $19/mo | Built-in | Yes (native) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes (EU) | No | — (current) |
| **Supabase** | Managed PG | 15 | 500 MB | $25/mo | Supavisor | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Tier 1 |
| **Railway** | Managed PG | 15 | No | ~$5.55/mo | No | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes | Tier 1 |
| **Render** | Managed PG | 15 | 1 GB (30d) | ~$7/mo | No | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes | Tier 1 |
| **Fly.io PG** | Self-managed | 16 | No | ~$2/mo | No | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes (co-loc) | No | Tier 2 |
| **Aiven** | Managed PG | 15 | 1 GB | $5/mo | PgBouncer | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Varies | Varies | Tier 1 |
| **AWS RDS** | Managed PG | 16 | 12-mo free | ~$15/mo | RDS Proxy ($) | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes | Tier 1 |
| **Tembo** | Managed PG | 15 | Limited | TBD | No | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Varies | Varies | Tier 1 |
| **CockroachDB** | Compat | — | 5 GiB | Usage | Built-in | No | **No** | Yes | **No** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Tier 3 |
| **Turso** | libSQL | — | 5 GB | $8/mo | N/A | Yes | **No** | **No** | **No** | Partial | **No** | **No** | **No** | Partial | Yes | Yes | Tier 3 |
| **PlanetScale** | MySQL | — | No | $39/mo | Built-in | No | **No** | **No** | **No** | Diff syntax | **No** | **No** | **No** | **No** | Yes | Yes | Tier 3 |

---

### D. Migration Complexity Assessment

#### Tier 1 — Connection String Swap + Web Driver Change (1–2 hours)

**Applies to:** Supabase, Railway, Render, Aiven, AWS RDS, Tembo

Steps:
1. **Worker:** Change `DATABASE_URL` environment variable in Fly.io secrets. SQLAlchemy + psycopg3 async works with any standard Postgres — zero code changes in `worker/src/db.py`.
2. **Web:** Replace `@neondatabase/serverless` with `postgres` (postgres.js) in `web/src/lib/db.ts`. This is the **only Neon-specific dependency** in the codebase.
3. **Queries:** The 4 query files (`rankings.ts`, `agents.ts`, `analytics.ts`, `backtest.ts`) use standard SQL tagged templates (`sql\`...\``) — no changes needed regardless of driver.
4. **Data migration:** `pg_dump` from Neon → `pg_restore` to new provider. Partitioned tables may need `--no-owner --no-privileges` flags.

#### Tier 2 — Tier 1 + Ongoing Ops Burden

**Applies to:** Fly.io Postgres

Same code changes as Tier 1, plus:
- Set up automated backups (cron → `pg_dump` → S3/volume)
- Configure monitoring (pg_stat_statements, disk alerts)
- Handle Postgres version upgrades manually
- No automatic failover — single point of failure unless you set up Stolon/Patroni

#### Tier 3 — Schema and Code Rewrite (Days to Weeks)

**Applies to:** CockroachDB (~2–3 days), Turso/PlanetScale (not viable)

CockroachDB specifics:
- Remove all `RANGE` partitioning DDL from migrations (CockroachDB uses hash-sharding)
- Replace `pg_advisory_xact_lock` with CockroachDB's `SELECT FOR UPDATE` or application-level distributed locks
- Test all JSONB operations (mostly compatible but edge cases exist)

Turso/PlanetScale:
- Full ORM rewrite, different query syntax, loss of too many features — not practical for this project.

---

### E. Cost Projection

Two scale points: **current** (28 agents, <1 GB data) and **projected** (104 agents post-feature #9, estimated 5–15 GB at 6 months).

| Provider | Current Scale (28 agents, <1 GB) | Projected Scale (104 agents, 5–15 GB) |
|----------|----------------------------------|----------------------------------------|
| **Neon** (current) | $0/mo (free tier) | $19/mo (Pro — 10 GiB included) |
| **Supabase** | $0/mo (free tier, if active weekly) | $25/mo (Pro — 8 GiB, +$0.125/GB over) |
| **Railway** | ~$0.55/mo (usage-based) | ~$3–8/mo (scales with storage + compute) |
| **Render** | ~$7/mo (no usable free tier) | ~$7–15/mo (scales with storage) |
| **Fly.io PG** | ~$2–4/mo (shared VM + storage) | ~$5–10/mo (may need larger VM) |
| **Aiven** | $0/mo (free tier, 1 GB) | $5–19/mo (Hobbyist 4 GB → Business) |
| **AWS RDS** | $0/mo (12-month free tier) | ~$15–30/mo (db.t3.micro/small + storage) |
| **Tembo** | $0/mo (free tier) | TBD (pricing evolving) |
| **CockroachDB** | $0/mo (free tier) | $0/mo (50M RU likely sufficient) — but Tier 3 migration cost |

**Key insight:** At current scale, Neon's free tier works. The first provider that becomes cheaper than Neon Pro ($19/mo) at the 5–15 GB scale point is **Railway** (~$3–8/mo) or **Fly.io Postgres** (~$5–10/mo), but both lack Neon's serverless driver and managed convenience.

---

### F. Region & Latency Analysis

The worker runs in **Amsterdam (AMS)** and the web app runs in **US-East (IAD1)**. Database placement creates an unavoidable latency tradeoff:

| Scenario | Worker → DB | Web → DB | Notes |
|----------|-------------|----------|-------|
| **DB in EU (current — Neon)** | ~1–5ms | ~80–120ms | Fast writes, slow reads. Users see latency on page loads. |
| **DB in US-East** | ~80–120ms | ~1–5ms | Slow writes, fast reads. Pipeline cycles take longer. |
| **DB in EU + move worker to IAD1** | ~80–120ms | ~1–5ms | Same as above but simpler — just redeploy worker to `iad1` |
| **DB in US-East + move worker to IAD1** | ~1–5ms | ~1–5ms | **Optimal.** Everything co-located in US-East. |

**Recommendation:** The cleanest latency fix is to **move the worker from AMS to IAD1** (change `primary_region` in `worker/fly.toml`) and place the database in US-East. This co-locates worker + web + DB in the same region. The only reason the worker is in AMS is proximity to Binance EU endpoints — but Binance API latency from US-East is still <100ms (acceptable for 15m+ timeframes).

**Per-provider region availability near IAD1 (US-East):**
- Neon: Yes (`us-east-1`, `us-east-2`)
- Supabase: Yes (`us-east-1`)
- Railway: Yes (`us-east`)
- Render: Yes (`ohio`)
- Fly.io PG: Yes (any Fly region including `iad`)
- Aiven: Yes (`us-east` on paid tiers, limited on free)
- AWS RDS: Yes (`us-east-1` — native)

---

### G. Recommendation (Ranked Shortlist)

**1. Stay with Neon (recommended)**
- Zero migration cost, already working
- Only provider with a **native Vercel serverless HTTP driver** — this matters because Vercel edge/serverless functions can't hold persistent TCP connections; Neon's driver uses HTTP/WebSocket under the hood
- Scale-to-zero on free tier saves money while traffic is low
- Clear upgrade path: $19/mo Pro when storage exceeds 0.5 GiB
- Database branching is useful for testing migrations
- **Action:** When 0.5 GiB ceiling is hit, upgrade to Neon Pro. Optionally move the Neon project to `us-east-1` and relocate the worker to `iad1` to eliminate cross-region latency.

**2. Supabase — best alternative if leaving Neon**
- Full managed Postgres with all 8 features
- Supavisor pooler included, good dashboard, active community
- $25/mo is slightly more than Neon Pro ($19/mo) but includes extras
- Tier 1 migration: ~1–2 hours
- **Tradeoff:** No native serverless driver — need `postgres.js` with connection pooler URL on the web side

**3. Railway — best budget option**
- Incredibly cheap at low scale (~$0.55/mo for current usage)
- Full Postgres, simple DX, usage-based pricing
- **Tradeoff:** No free tier, no pooler, no serverless driver. Best if cost is the primary concern.

**4. AWS RDS — best for US-East co-location with Vercel**
- 12-month free tier with 20 GB storage
- Native US-East-1 placement = lowest latency for Vercel web reads
- Battle-tested managed Postgres
- **Tradeoff:** AWS complexity, $15+/mo after free year, needs RDS Proxy for pooling

**5. Fly.io Postgres — best for worker write latency**
- Co-located with worker = sub-1ms write latency
- Cheapest dedicated instance (~$2/mo)
- **Tradeoff:** Self-managed (backups, monitoring, upgrades are your responsibility), web reads still cross-region unless worker moves too

---

### Key Files Referenced

| File | Relevance |
|------|-----------|
| `worker/src/db.py` | Async engine config — `pool_size=5`, `max_overflow=10` via psycopg3 |
| `web/src/lib/db.ts` | Neon serverless driver — the **only** Neon-specific code dependency |
| `worker/src/models/db.py` | 16 ORM models using all 8 Postgres features |
| `worker/src/pipeline/runner.py` | Advisory locks + ON CONFLICT upserts |
| `worker/fly.toml` | Worker region: `ams` |
| `web/vercel.json` | Web region: `iad1` |
| `web/src/lib/queries/` | 4 query files using standard SQL tagged templates |
