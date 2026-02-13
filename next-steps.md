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
