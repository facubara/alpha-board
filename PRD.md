# Alpha Board -- Product Requirements Document

**Version:** 2.0
**Date:** 2026-02-04
**Status:** Draft

---

## 1. Executive Summary

Alpha Board is a crypto market analytics platform with two core systems:

1. **Bullish Rankings Engine** -- Ranks the top 200 USDT-quoted Binance pairs from most bullish to least bullish across six timeframes (15m to 1W), powered by precomputed technical indicators and a composite scoring methodology.

2. **AI Trading Agents** -- 28 autonomous Claude-powered agents that consume rankings, raw OHLCV data, and indicator signals to make mock trading decisions (long/short) with virtual portfolios. Agents operate with distinct strategies, evolve their own prompts based on performance, accumulate a memory bank of past decisions, and can be manually tuned via prompt editing. All trading is simulated against real price movement.

The product answers two questions: **"What looks most bullish right now?"** and **"Which trading strategy is performing best, and why?"**

---

## 2. Problem Statement

**For the rankings engine:** Experienced crypto traders monitor dozens of pairs across multiple timeframes. Manually scanning charts for confluence of bullish signals is slow, error-prone, and doesn't scale. Existing screeners either overwhelm with raw indicator values, hide their methodology, or require paid subscriptions for multi-timeframe analysis.

**For the agent system:** Developing and validating trading strategies is expensive and slow. Traders have intuitions about what works but no cheap way to test multiple strategies simultaneously in parallel, compare them objectively, and iterate. AI agents can explore strategy space faster than a human can, but only if their reasoning is transparent and their performance is rigorously tracked.

---

## 3. Goals and Non-Goals

### Goals

| ID | Goal |
|----|------|
| G1 | Rank top 200 USDT pairs by bullish strength per timeframe |
| G2 | Make timeframe switching feel instant (<200ms perceived latency) |
| G3 | Provide a confidence metric that reflects signal agreement and data quality |
| G4 | Surface key signal highlights (chips) per symbol without requiring expansion |
| G5 | Keep indicator architecture pluggable so new indicators can be added without schema changes |
| G6 | Retain 90 days of historical ranking snapshots |
| G7 | Run 28 AI trading agents with distinct strategies across all timeframes |
| G8 | Track agent performance with virtual portfolios (PnL, win rate, drawdown, token cost) |
| G9 | Enable agents to autonomously evolve their strategy prompts based on performance |
| G10 | Provide full transparency into agent reasoning for every decision |
| G11 | Allow manual prompt editing per agent for human-guided strategy tuning |
| G12 | Rank and compare agents by trading performance on a leaderboard |

### Non-Goals

| ID | Non-Goal | Reason |
|----|----------|--------|
| NG1 | Real trading or order execution | All trading is simulated. No exchange API keys for orders. |
| NG2 | Financial advice claims | Legal constraint |
| NG3 | User portfolios or watchlists | No auth in v1 |
| NG4 | Real-time websocket streaming | Contradicts precomputation model |
| NG5 | Charting or price visualization | Users have TradingView for this |
| NG6 | Mobile-native app | Responsive web is sufficient for v1 |

---

## 4. User Personas

### Primary: The Strategy Experimenter

- Wants to test multiple trading strategies in parallel without risking capital
- Comfortable with AI/LLMs and understands prompt engineering basics
- Wants to read agent reasoning to validate or challenge decisions
- Cares about risk-adjusted returns, not just raw PnL
- Will tweak agent prompts and model assignments to optimize performance

### Secondary: The Multi-Timeframe Scanner

- Trades crypto actively (daily to weekly)
- Uses 2-4 timeframes to confirm setups
- Has 50-200 pairs on a watchlist but can't scan them all manually
- Understands RSI, MACD, EMAs, Bollinger Bands
- Wants a pre-filtered starting point, not a replacement for their own analysis
- Values transparency in how scores are computed

### Tertiary: The Swing Trader

- Checks markets once or twice a day
- Primarily uses 4H and 1D timeframes
- Wants to quickly identify which pairs have the strongest bullish confluence
- Less interested in indicator breakdowns, more interested in the ranking itself

---

## 5. User Stories

### Rankings

| ID | Story | Priority |
|----|-------|----------|
| US1 | As a trader, I can view a ranked list of symbols sorted by bullish score for the 1H timeframe so I can identify setups quickly. | P0 |
| US2 | As a trader, I can switch to the 4H timeframe and see a completely re-ranked list instantly, without a loading spinner. | P0 |
| US3 | As a trader, I can see signal highlight chips (e.g., "Above 200 EMA", "RSI Oversold") on each row without expanding it, so I get context at a glance. | P0 |
| US4 | As a trader, I can expand a row to see the full indicator breakdown (bullish/neutral/bearish per indicator) to understand why a symbol ranked where it did. | P0 |
| US5 | As a trader, I can see the confidence score alongside the bullish score so I know how much agreement exists among indicators. | P0 |
| US6 | As a trader, I can see when the data was last updated for the current timeframe so I know how fresh the ranking is. | P1 |
| US7 | As a trader, I can sort the table by score, confidence, or symbol name. | P1 |
| US8 | As a trader, I can search/filter by symbol name to find a specific pair. | P1 |
| US9 | As a trader, I can see score change direction (up/down/new) relative to the previous snapshot. | P2 |

### Agents

| ID | Story | Priority |
|----|-------|----------|
| US10 | As a user, I can view all 28 agents on a leaderboard ranked by total PnL, with key metrics (win rate, max drawdown, trade count, token cost) visible per agent. | P0 |
| US11 | As a user, I can click into an agent to see its full trade history with entry/exit prices, position size, direction (long/short), and realized PnL per trade. | P0 |
| US12 | As a user, I can read the full reasoning an agent produced for each trade decision, so I understand why it entered or exited a position. | P0 |
| US13 | As a user, I can see each agent's current strategy prompt and edit it to adjust its behavior. | P0 |
| US14 | As a user, I can see the prompt evolution history for an agent -- what changed, when, and whether the change was auto-generated or human-edited. | P1 |
| US15 | As a user, I can configure which Claude model each agent uses for each task type (routine scan, trade decision, strategy evolution) so I can control cost and quality. | P0 |
| US16 | As a user, I can see how many tokens each agent has consumed and the estimated dollar cost, so I can manage API spend. | P0 |
| US17 | As a user, I can filter the agent leaderboard by timeframe (show only 1H agents, only cross-timeframe agents, etc.). | P1 |
| US18 | As a user, I can pause or resume an agent without deleting its history. | P1 |
| US19 | As a user, I can see an agent's open positions and unrealized PnL at any time. | P0 |

---

## 6. Functional Requirements

### 6.1 Data Ingestion (Python Backend)

| ID | Requirement |
|----|-------------|
| FR1 | Fetch OHLCV candle data from Binance REST API for all active USDT-quoted spot pairs with 24h quote volume above $1M (filters out illiquid pairs). |
| FR2 | Fetch sufficient candle history per timeframe to compute all indicators (minimum 200 candles for 200-period EMA). |
| FR3 | Persist raw OHLCV data in the database for indicator computation and agent context. Raw data may be overwritten per symbol/timeframe (not historical). |
| FR4 | Maintain a `symbols` registry table that is refreshed daily, tracking which pairs are active and meet the volume threshold. |

### 6.2 Indicator Computation (Python Backend)

| ID | Requirement |
|----|-------------|
| FR5 | Compute the following indicators per symbol per timeframe: RSI(14), MACD(12,26,9), Stochastic(14,3,3), ADX(14), OBV, Bollinger Bands(20,2), EMA(20), EMA(50), EMA(200). |
| FR6 | Normalize each indicator output into a discrete signal: `bullish`, `neutral`, or `bearish`. Signal thresholds are defined in a configuration file, not hardcoded. |
| FR7 | Generate highlight tags per symbol (e.g., "Above 200 EMA", "RSI > 70", "MACD Cross Up", "Squeeze") derived from indicator state. Tags are stored as a JSON array. |
| FR8 | New indicators can be added by: (a) implementing a compute function, (b) adding signal normalization rules to config, (c) registering the indicator in the indicators table. No schema migration required. |

### 6.3 Scoring (Python Backend)

| ID | Requirement |
|----|-------------|
| FR9 | Aggregate individual indicator signals into a composite bullish score between 0.0 (maximally bearish) and 1.0 (maximally bullish). |
| FR10 | Compute a confidence score between 0 and 100 reflecting: (a) degree of agreement among indicators, (b) data completeness (e.g., new listings with insufficient history get lower confidence). |
| FR11 | Rank all symbols by bullish score descending within each timeframe. Ties are broken by confidence score descending. |
| FR12 | Persist each computation run as an immutable snapshot row. Never overwrite previous snapshots. |

### 6.4 AI Trading Agents (Python Backend)

| ID | Requirement |
|----|-------------|
| FR20 | Support 28 agents total: 4 agents per timeframe (24 timeframe-specific) + 4 cross-timeframe agents that receive data from all 6 timeframes. |
| FR21 | Each agent has a distinct base strategy defined via system prompt. Initial strategies: momentum trader, mean-reversion trader, breakout hunter, conservative swing trader. These 4 archetypes repeat across timeframes. Cross-timeframe agents have 4 distinct multi-TF strategies. |
| FR22 | Agents receive as context: raw OHLCV data (recent candles), precomputed indicator signals, bullish scores, confidence scores, and the full ranking for their timeframe(s). |
| FR23 | Each agent maintains a virtual portfolio starting at $10,000 USDT. The portfolio tracks: cash balance, open positions, closed positions, total equity. |
| FR24 | Agent trade actions: `open_long`, `open_short`, `close_position`, `adjust_stop_loss`, `adjust_take_profit`, `hold` (no action). Each action requires: symbol, position size (in USDT), stop-loss price, take-profit price. |
| FR25 | Agents make decisions once per candle close for their assigned timeframe. Cross-timeframe agents decide on the shortest timeframe's candle close (15m). |
| FR26 | Open positions are evaluated against real Binance price data. Stop-losses and take-profits trigger automatically when price crosses the threshold during any candle in the agent's timeframe. |
| FR27 | PnL is calculated using actual price movement: `(exit_price - entry_price) / entry_price * position_size` for longs, inverted for shorts. Trading fees are simulated at 0.1% per trade (entry + exit). |
| FR28 | Each agent decision (including `hold`) is logged with the full Claude response (verbatim) plus an auto-generated 1-2 sentence summary. |

### 6.5 Agent Learning & Evolution (Python Backend)

| ID | Requirement |
|----|-------------|
| FR29 | Each agent maintains a **memory bank**: a persistent, append-only log of past trades with outcomes, stored in the database. Recent memory entries (last 20 trades) are included in the agent's context for each decision. |
| FR30 | **Automated prompt evolution**: After every N closed trades (configurable, default: 10), the system triggers a strategy review. A meta-prompt sends the agent its recent performance stats and current strategy, and asks it to propose revisions to its own strategy prompt. The revised prompt is saved and becomes active for subsequent decisions. |
| FR31 | **Human prompt editing**: Users can edit any agent's strategy prompt through the UI at any time. Human edits are flagged as `source: human` in the prompt history. |
| FR32 | **Prompt version history**: Every strategy prompt change (auto-evolved or human-edited) is stored as an immutable version with timestamp, source (`auto` or `human`), the diff from the previous version, and performance stats at the time of change. |
| FR33 | Agents can reference their memory bank to avoid repeating mistakes (e.g., "Last time I longed DOGEUSDT during low ADX, I lost 3%. Avoiding similar setups."). |

### 6.6 Agent Model Configuration (Python Backend)

| ID | Requirement |
|----|-------------|
| FR34 | Each agent has three independently configurable model slots: `scan_model` (routine market scans), `trade_model` (trade entry/exit decisions), `evolution_model` (strategy review and prompt evolution). |
| FR35 | Supported models: any Anthropic Claude model (Haiku, Sonnet, Opus 4.5, and future releases). Model selection is stored per agent in the database. |
| FR36 | Default model assignments: Haiku for scans, Sonnet for trade decisions, Opus 4.5 for strategy evolution. These defaults can be overridden per agent. |
| FR37 | Token usage is tracked per agent per model per task type. The system records: input tokens, output tokens, model used, and estimated cost (based on published pricing). |

### 6.7 Frontend Display -- Rankings (Next.js)

| ID | Requirement |
|----|-------------|
| FR13 | Display a table of ranked symbols for the selected timeframe. Default timeframe: 1H. |
| FR14 | Each row displays: rank, symbol, bullish score (0-1 rendered as bar or percentage), confidence score, and highlight chips. |
| FR15 | Clicking/tapping a row expands it to show per-indicator signal breakdown (indicator name, signal, raw value). |
| FR16 | Timeframe selector (6 options) switches the displayed ranking. All timeframe data is prefetched or cached so switching is instant. |
| FR17 | Display "Last updated: [timestamp] ([relative time])" per timeframe. |
| FR18 | Provide a search input that filters rows by symbol name (client-side filter). |
| FR19 | Provide column sort on score and confidence (client-side sort). |

### 6.8 Frontend Display -- Agent Arena (Next.js)

| ID | Requirement |
|----|-------------|
| FR38 | **Agent Leaderboard page**: Table of all 28 agents, sortable by: total PnL, win rate, avg win/loss ratio, max drawdown, number of trades, total token cost. |
| FR39 | Leaderboard filterable by: timeframe (15m, 30m, 1h, 4h, 1d, 1w, cross-timeframe), strategy archetype (momentum, mean-reversion, breakout, swing). |
| FR40 | Each agent row shows: agent name, strategy archetype badge, assigned timeframe, total PnL (with color), win rate, trade count, current model assignments, token cost, status (active/paused). |
| FR41 | **Agent Detail page**: Clicking an agent opens a detail view with tabs: Overview, Trade History, Reasoning Log, Strategy Prompt, Model Config. |
| FR42 | **Overview tab**: Current equity curve (simple line chart), open positions with unrealized PnL, key performance metrics, memory bank size. |
| FR43 | **Trade History tab**: Chronological list of all trades. Each row: symbol, direction (long/short), entry price, exit price, position size, PnL, duration, 1-2 sentence reasoning summary. Expandable to show full Claude response. |
| FR44 | **Reasoning Log tab**: Full verbatim log of every agent decision (including `hold` decisions), with timestamp, action taken, and the complete Claude response. Searchable and filterable by action type. |
| FR45 | **Strategy Prompt tab**: Shows the current active prompt with a text editor for manual editing. Below the editor: version history timeline showing each prompt change with source badge (`auto`/`human`), date, and a diff view. |
| FR46 | **Model Config tab**: Three dropdowns (scan model, trade model, evolution model) per agent. Shows current token usage breakdown by task type with estimated cost. |
| FR47 | **Pause/Resume**: Toggle button per agent that stops/resumes decision-making. Paused agents retain all history and open positions but make no new decisions. |

---

## 7. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1 | Timeframe switch latency (perceived) | < 200ms (data already cached/prefetched) |
| NFR2 | Initial page load (LCP) | < 2s on 4G connection |
| NFR3 | Computation time per full run (200 pairs, 1 timeframe) | < 60s |
| NFR4 | Database row growth (rankings) | ~5.2M rows/month. Partition by month. |
| NFR5 | Data freshness | Rankings no older than 2x the timeframe interval |
| NFR6 | Availability | 99% uptime for frontend (Vercel SLA). Backend downtime means stale data, not broken UI. |
| NFR7 | Snapshot retention | 90 days. Automated cleanup of older rows. |
| NFR8 | Agent decision latency | Each agent decision must complete within 30s (Anthropic API timeout). Failed calls retry once. |
| NFR9 | Agent reasoning storage | Full verbatim responses stored. Estimated 1-3KB per decision. At 28 agents with variable frequency, ~50-200MB/month. |
| NFR10 | Token cost tracking accuracy | Token counts must match Anthropic API response headers exactly. Cost estimates updated when pricing changes. |
| NFR11 | Agent leaderboard load time | < 1s for 28 agents with all metrics |

---

## 8. Technical Architecture

```
                    +-----------+       +---------------+
                    |  Binance  |       |  Anthropic    |
                    |  REST API |       |  Claude API   |
                    +-----+-----+       +-------+-------+
                          |                     |
                   OHLCV fetch (cron)    Agent decisions
                          |                     |
                  +-------v---------------------v--+
                  |       Python Worker             |
                  |         (Fly.io)                |
                  |                                 |
                  |  ┌─────────────────────────┐    |
                  |  │ Rankings Pipeline        │    |
                  |  │ - fetch OHLCV            │    |
                  |  │ - compute indicators     │    |
                  |  │ - score & rank           │    |
                  |  └─────────────────────────┘    |
                  |                                 |
                  |  ┌─────────────────────────┐    |
                  |  │ Agent Orchestrator       │    |
                  |  │ - on candle close:       │    |
                  |  │   build agent context    │    |
                  |  │   call Claude API        │    |
                  |  │   parse trade actions    │    |
                  |  │   update portfolios      │    |
                  |  │   check SL/TP triggers   │    |
                  |  │   log reasoning          │    |
                  |  │ - on N trades closed:    │    |
                  |  │   trigger prompt evolve  │    |
                  |  └─────────────────────────┘    |
                  |                                 |
                  +---------------+-----------------+
                                  |
                             writes only
                                  |
                  +---------------v-----------------+
                  |         PostgreSQL               |
                  |   (Neon / Supabase / Fly PG)     |
                  +---------------+-----------------+
                                  |
                        reads + prompt writes
                        (from UI editing)
                                  |
                  +---------------v-----------------+
                  |         Next.js App              |
                  |           (Vercel)               |
                  |                                  |
                  |  ┌────────────┐ ┌─────────────┐  |
                  |  │ Rankings   │ │ Agent Arena  │  |
                  |  │ Pages      │ │ Pages        │  |
                  |  └────────────┘ └─────────────┘  |
                  +----------------------------------+
                                  |
                               serves
                                  |
                  +---------------v-----------------+
                  |            Browser               |
                  +----------------------------------+
```

### Key architectural decisions

**No direct API between Python and Next.js.** The database is the contract. This decouples deployment and means backend downtime results in stale (but functional) data rather than errors.

**Exception: Prompt editing.** When a user edits an agent's strategy prompt via the UI, Next.js writes the new prompt version directly to the database. The Python worker reads the latest active prompt before each agent decision. This is the only write path from the frontend.

**Prefetch all 6 timeframes on page load.** The total payload for 200 symbols x 6 timeframes is approximately ~100KB gzipped. This enables instant timeframe switching entirely client-side.

**ISR (Incremental Static Regeneration) per timeframe.** Each timeframe has its own revalidation interval matching its update cadence.

**Agent orchestration is sequential per timeframe.** On each candle close, the 4 agents for that timeframe run sequentially (not in parallel) to avoid Anthropic API rate limits. Cross-timeframe agents run after the 15m candle close. Total agent cycle: ~2-4 minutes for 4 agents.

**Structured output for agent decisions.** Agent Claude calls use tool_use / structured output to return a typed JSON action (open_long, close_position, hold, etc.) alongside free-text reasoning. This ensures parseable actions while preserving full reasoning transparency.

**PostgreSQL connection pooling.** Next.js on Vercel requires connection pooling (PgBouncer or Neon's built-in pooler) since serverless functions cannot hold persistent connections.

---

## 9. Data Model

### 9.1 `symbols`

Tracks active trading pairs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial PK` | |
| `symbol` | `varchar(20) UNIQUE` | e.g., `BTCUSDT` |
| `base_asset` | `varchar(10)` | e.g., `BTC` |
| `quote_asset` | `varchar(10)` | Always `USDT` in v1 |
| `is_active` | `boolean` | Set false when delisted or below volume threshold |
| `last_seen_at` | `timestamptz` | Last time this symbol appeared in the active set |
| `created_at` | `timestamptz` | |

### 9.2 `snapshots`

One row per symbol per timeframe per computation run.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigserial PK` | |
| `symbol_id` | `int FK -> symbols.id` | |
| `timeframe` | `varchar(4)` | `15m`, `30m`, `1h`, `4h`, `1d`, `1w` |
| `bullish_score` | `numeric(4,3)` | 0.000 to 1.000 |
| `confidence` | `smallint` | 0 to 100 |
| `rank` | `smallint` | 1-based rank within this timeframe for this run |
| `highlights` | `jsonb` | Array of tag strings |
| `indicator_signals` | `jsonb` | Full breakdown per indicator |
| `computed_at` | `timestamptz` | |
| `run_id` | `uuid` | Groups all symbols from the same computation run |

Partition by month on `computed_at`.

### 9.3 `indicators` (registry)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial PK` | |
| `name` | `varchar(30) UNIQUE` | e.g., `rsi_14` |
| `display_name` | `varchar(50)` | e.g., `RSI (14)` |
| `category` | `varchar(20)` | `momentum`, `trend`, `volume`, `volatility` |
| `weight` | `numeric(3,2)` | Weight in composite score |
| `is_active` | `boolean` | |
| `config` | `jsonb` | Parameters, thresholds |

### 9.4 `computation_runs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | |
| `timeframe` | `varchar(4)` | |
| `started_at` | `timestamptz` | |
| `finished_at` | `timestamptz` | |
| `symbol_count` | `smallint` | |
| `status` | `varchar(10)` | `running`, `completed`, `failed` |
| `error_message` | `text` | |

### 9.5 `agents`

Core agent registry.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial PK` | |
| `name` | `varchar(50) UNIQUE` | e.g., `momentum-1h-alpha` |
| `display_name` | `varchar(100)` | e.g., `Momentum Trader (1H) #1` |
| `strategy_archetype` | `varchar(20)` | `momentum`, `mean_reversion`, `breakout`, `swing` |
| `timeframe` | `varchar(10)` | `15m`, `30m`, `1h`, `4h`, `1d`, `1w`, or `cross` for cross-TF agents |
| `scan_model` | `varchar(50)` | e.g., `claude-haiku-3-5-20241022` |
| `trade_model` | `varchar(50)` | e.g., `claude-sonnet-4-20250514` |
| `evolution_model` | `varchar(50)` | e.g., `claude-opus-4-5-20251101` |
| `status` | `varchar(10)` | `active`, `paused` |
| `initial_balance` | `numeric(12,2)` | Default: 10000.00 |
| `evolution_trade_threshold` | `smallint` | Number of closed trades before auto-evolution triggers. Default: 10 |
| `created_at` | `timestamptz` | |

### 9.6 `agent_prompts`

Immutable prompt version history.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial PK` | |
| `agent_id` | `int FK -> agents.id` | |
| `version` | `smallint` | Auto-incrementing per agent |
| `system_prompt` | `text` | The full strategy prompt |
| `source` | `varchar(10)` | `initial`, `auto`, `human` |
| `diff_from_previous` | `text` | Human-readable diff. Null for version 1. |
| `performance_at_change` | `jsonb` | Snapshot of agent metrics at the time of change: `{pnl, win_rate, trades, drawdown}` |
| `created_at` | `timestamptz` | |
| `is_active` | `boolean` | Only one active per agent at a time |

Index: `(agent_id, is_active)` filtered on `is_active = true`.

### 9.7 `agent_portfolios`

Current state of each agent's portfolio. Updated in place (not append-only -- historical state is derivable from trades).

| Column | Type | Notes |
|--------|------|-------|
| `agent_id` | `int PK FK -> agents.id` | One row per agent |
| `cash_balance` | `numeric(14,2)` | Available USDT |
| `total_equity` | `numeric(14,2)` | Cash + unrealized PnL of open positions |
| `total_realized_pnl` | `numeric(14,2)` | Cumulative closed-trade PnL |
| `total_fees_paid` | `numeric(14,2)` | Cumulative simulated trading fees |
| `updated_at` | `timestamptz` | |

### 9.8 `agent_positions`

Open positions. Rows are deleted when positions close (the trade record in `agent_trades` persists).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial PK` | |
| `agent_id` | `int FK -> agents.id` | |
| `symbol_id` | `int FK -> symbols.id` | |
| `direction` | `varchar(5)` | `long` or `short` |
| `entry_price` | `numeric(18,8)` | |
| `position_size` | `numeric(14,2)` | In USDT |
| `stop_loss` | `numeric(18,8)` | Nullable (agent may choose not to set) |
| `take_profit` | `numeric(18,8)` | Nullable |
| `opened_at` | `timestamptz` | |
| `unrealized_pnl` | `numeric(14,2)` | Updated on each candle close |

Index: `(agent_id)` for fast lookup of all open positions.

### 9.9 `agent_trades`

Immutable record of every completed trade.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigserial PK` | |
| `agent_id` | `int FK -> agents.id` | |
| `symbol_id` | `int FK -> symbols.id` | |
| `direction` | `varchar(5)` | `long` or `short` |
| `entry_price` | `numeric(18,8)` | |
| `exit_price` | `numeric(18,8)` | |
| `position_size` | `numeric(14,2)` | In USDT |
| `pnl` | `numeric(14,2)` | Realized PnL after fees |
| `fees` | `numeric(10,2)` | Entry + exit fees |
| `exit_reason` | `varchar(20)` | `agent_decision`, `stop_loss`, `take_profit` |
| `opened_at` | `timestamptz` | |
| `closed_at` | `timestamptz` | |
| `duration_minutes` | `int` | Convenience column |
| `decision_id` | `bigint FK -> agent_decisions.id` | Links to the decision that opened this trade |
| `close_decision_id` | `bigint FK -> agent_decisions.id` | Links to the decision that closed it (null if SL/TP) |

Index: `(agent_id, closed_at DESC)`.

### 9.10 `agent_decisions`

Every decision an agent makes, including `hold`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigserial PK` | |
| `agent_id` | `int FK -> agents.id` | |
| `action` | `varchar(20)` | `open_long`, `open_short`, `close_position`, `adjust_stop_loss`, `adjust_take_profit`, `hold` |
| `symbol_id` | `int FK -> symbols.id` | Nullable (null for `hold` with no specific symbol) |
| `reasoning_full` | `text` | Verbatim Claude response |
| `reasoning_summary` | `varchar(500)` | Auto-generated 1-2 sentence summary |
| `action_params` | `jsonb` | Structured action details: `{size, stop_loss, take_profit, ...}` |
| `model_used` | `varchar(50)` | Which Claude model produced this decision |
| `input_tokens` | `int` | |
| `output_tokens` | `int` | |
| `estimated_cost_usd` | `numeric(8,4)` | |
| `prompt_version` | `smallint` | Which prompt version was active |
| `decided_at` | `timestamptz` | |

Index: `(agent_id, decided_at DESC)`.
Partition by month on `decided_at`.

### 9.11 `agent_memory`

Append-only memory bank for agent learning.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigserial PK` | |
| `agent_id` | `int FK -> agents.id` | |
| `trade_id` | `bigint FK -> agent_trades.id` | The trade this memory relates to |
| `lesson` | `text` | Agent-generated reflection on the trade outcome (1-3 sentences) |
| `tags` | `jsonb` | Categorization: `["loss", "stop_loss_hit", "low_adx", "DOGEUSDT"]` |
| `created_at` | `timestamptz` | |

Index: `(agent_id, created_at DESC)`.

### 9.12 `agent_token_usage`

Aggregated token usage for cost tracking. One row per agent per model per day.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial PK` | |
| `agent_id` | `int FK -> agents.id` | |
| `model` | `varchar(50)` | |
| `task_type` | `varchar(15)` | `scan`, `trade`, `evolution` |
| `date` | `date` | |
| `input_tokens` | `bigint` | Accumulated for the day |
| `output_tokens` | `bigint` | |
| `estimated_cost_usd` | `numeric(10,4)` | |

Index: `(agent_id, date DESC)`.

### Design notes

- **`indicator_signals` is JSONB, not normalized rows.** Faster reads, easier schema evolution. The frontend never queries by individual indicator.
- **`highlights` is denormalized.** The frontend reads this directly to render chips.
- **Agent decisions include `hold`.** This is essential for understanding agent behavior -- knowing when an agent chose not to act is as informative as when it did.
- **Memory bank is agent-generated.** After each trade closes, the agent is asked to produce a brief reflection/lesson. This is cheaper than re-processing full trade context later.
- **Portfolio table is mutable.** Unlike snapshots and decisions, the portfolio is updated in place because the full history is derivable from trades. This avoids an ever-growing portfolio timeline table.

---

## 10. Scoring & Confidence Methodology

### Bullish Score (0.0 -- 1.0)

Each indicator produces a discrete signal: `bullish` (+1), `neutral` (0), or `bearish` (-1).

The composite score is a weighted average of all active indicator signals, rescaled from [-1, +1] to [0, 1]:

```
raw = sum(signal_i * weight_i) / sum(weight_i)
bullish_score = (raw + 1) / 2
```

**Default weights (v1):**

| Indicator | Weight | Rationale |
|-----------|--------|-----------|
| RSI (14) | 0.12 | Momentum baseline |
| MACD (12,26,9) | 0.15 | Trend momentum, slightly higher weight for trend confirmation |
| Stochastic (14,3,3) | 0.10 | Complements RSI, lower weight to avoid redundancy |
| ADX (14) | 0.13 | Trend strength (signal is based on +DI vs -DI direction) |
| OBV | 0.12 | Volume confirmation |
| Bollinger Bands (20,2) | 0.10 | Volatility context |
| EMA 20 vs price | 0.08 | Short-term trend |
| EMA 50 vs price | 0.10 | Medium-term trend |
| EMA 200 vs price | 0.10 | Long-term trend |

Weights are stored in the `indicators` table and can be adjusted without code changes.

### Confidence Score (0 -- 100)

Three factors contribute:

1. **Signal agreement (60%):** Standard deviation of signal values -- lower deviation means higher agreement.
2. **Data completeness (25%):** Missing indicators (e.g., EMA 200 for new listings) reduce confidence proportionally.
3. **Volume adequacy (15%):** Percentile rank of 24h volume within the active symbol set.

### Highlight Chips

Human-readable tags derived from indicator state. Examples: `Above 200 EMA`, `RSI Oversold`, `MACD Cross Up`, `BB Squeeze`, `Volume Spike`, `Strong Trend`. Each symbol gets 0-4 chips.

---

## 11. Update Cadence per Timeframe

### Rankings Pipeline

| Timeframe | Computation Frequency | ISR Revalidation | Rationale |
|-----------|-----------------------|-------------------|-----------|
| 15m | Every 5 minutes | 60 seconds | High-frequency traders expect near-live data |
| 30m | Every 10 minutes | 120 seconds | Balanced freshness |
| 1h | Every 15 minutes | 300 seconds | Hourly candles don't change mid-candle |
| 4h | Every 30 minutes | 600 seconds | Slower-moving signals |
| 1d | Every 2 hours | 1800 seconds | Daily candles only close once |
| 1w | Every 6 hours | 3600 seconds | Weekly data changes slowly |

### Agent Decision Cadence

| Agent Type | Decision Trigger | Rationale |
|------------|-----------------|-----------|
| 15m agents | Every 15m candle close | One decision per completed candle |
| 30m agents | Every 30m candle close | |
| 1h agents | Every 1h candle close | |
| 4h agents | Every 4h candle close | |
| 1d agents | Every daily candle close (00:00 UTC) | |
| 1w agents | Every weekly candle close (Monday 00:00 UTC) | |
| Cross-TF agents | Every 15m candle close | Use the shortest interval to capture cross-TF signals promptly |

**Computation order per cycle:**
1. Rankings pipeline runs first (indicators, scores, rankings)
2. Agent orchestrator runs after rankings are persisted (agents need fresh rankings as context)
3. Agents for the relevant timeframe run sequentially (4 agents, one at a time)
4. Stop-loss / take-profit checks run on every cycle for all agents with open positions

**Strategy evolution** runs asynchronously after a trade closes, not during the decision cycle. This avoids blocking time-sensitive decisions.

---

## 12. Risks and Tradeoffs

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Binance API rate limiting** | High | Computation delays | Batch requests. Exponential backoff. Stay within 1200 req/min. |
| **Anthropic API rate limits** | High | Agent decisions delayed or missed | Sequential agent execution (not parallel). Retry with backoff. For 15m agents (4 agents x every 15min), expect ~16 Claude calls/hour -- well within limits. |
| **Anthropic API cost overruns** | Medium | Budget exceeded | Token tracking per agent. Haiku for scans, Sonnet for trades, Opus for evolution. Configurable per agent. Budget alerts in the UI. |
| **Agent produces unparseable output** | Medium | Trade action lost | Structured output / tool_use forces schema compliance. If parsing still fails, log the raw response as a `hold` decision and alert. |
| **Agent prompt evolution degrades strategy** | Medium | Performance regression | Store prompt version history. Performance snapshot at each change. If PnL drops >20% after an auto-evolution, auto-revert to previous prompt and flag for human review. |
| **Database connection limits from Vercel** | Medium | Frontend errors | Use connection pooler. |
| **Computation exceeds cron window** | Medium | Stale data | Advisory lock prevents overlapping runs. Monitor run duration. |
| **PostgreSQL storage growth** | Medium | Cost increase | Monthly partitioning. 90-day retention for snapshots. Agent decisions retained longer (indefinitely for v1, revisit at 6 months). |
| **Fly.io machine sleeps or restarts** | Medium | Missed cycles | Health checks. Self-healing: next successful run catches up. |

### Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Users treat agent results as real trading advice** | High | Legal risk | Prominent disclaimer on every agent page. All balances labeled "SIMULATED". No real money involved. |
| **Agent strategies converge to identical behavior after evolution** | Medium | Loss of diversity | Track strategy drift score (cosine similarity between prompts). Alert if two agents' prompts become >80% similar. |
| **Agents make nonsensical trades** | Medium | Loss of trust | Full reasoning transparency. Users can read every decision. Pausing mechanism for underperforming agents. |
| **Prompt evolution creates runaway strategies** | Low | Unstable behavior | Cap max position size at 25% of portfolio. Cap max concurrent positions at 5. These are hard limits enforced by the orchestrator, not the prompt. |

### Key Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| JSONB for indicator signals | Faster reads, easier evolution, harder cross-indicator SQL queries. Acceptable for v1. |
| Full verbatim reasoning storage | High storage (~50-200MB/month) but complete transparency. Worth it for an agent-centric product. |
| Sequential agent execution | Slower cycle but avoids API rate limits and simplifies error handling. At 4 agents per cycle, ~2-4 minutes total. Acceptable. |
| Mutable portfolio table | Simpler queries for current state but no portfolio timeline. Historical state derivable from trades. |
| Auto-evolution without human approval | Faster iteration but risk of degradation. Mitigated by auto-revert on significant PnL drop. |
| Memory bank of last 20 trades only | Keeps context window manageable but loses older lessons. Acceptable because prompt evolution captures durable learnings. |
| 28 agents (4 per TF + 4 cross) | Enough diversity to compare strategies meaningfully. More agents = more API cost. Can scale later if justified by results. |

---

## 13. Open Questions and Future Extensions

### Open Questions

| # | Question | Impact | Decision needed by |
|---|----------|--------|--------------------|
| OQ1 | Which managed PostgreSQL provider? Neon (generous free tier, built-in pooler) vs. Supabase (more features) vs. Fly Postgres (co-located with worker). | Affects latency and cost. | Before development starts |
| OQ2 | Should the 15m timeframe computation run every 5 minutes or every 15 minutes? | Affects data accuracy vs. freshness. | During backend development |
| OQ3 | Should stablecoins (USDCUSDT, DAIUSDT, etc.) be excluded from rankings? | Affects ranking quality. | Before launch |
| OQ4 | Should the frontend support dark mode only, light mode only, or both? | Affects development scope. | Before frontend development |
| OQ5 | How should recently listed symbols (< 200 candles) be handled? | Affects data completeness. | During scoring implementation |
| OQ6 | What are the 4 cross-timeframe strategy archetypes? They need to differ from single-TF strategies since they have richer context. | Affects agent prompt design. | During agent development |
| OQ7 | Should agents be allowed to hold multiple positions in the same symbol? | Affects position management complexity. | During agent development |
| OQ8 | Should there be a hard API cost ceiling per agent per day that auto-pauses the agent? | Affects cost control. | Before launch |
| OQ9 | How should agent decisions handle Binance maintenance windows when price data is unavailable? | Affects reliability. | During backend development |

### Future Extensions (post-v1)

| Extension | Description | Prerequisite |
|-----------|-------------|-------------|
| **Agent tournaments** | Periodic resets where agents compete from equal starting balance. Leaderboard tracks tournament wins. | Tournament scheduling logic. |
| **Genetic prompt evolution** | Cross-breed prompts from top-performing agents to create new agents. | Prompt similarity analysis. |
| **Real trading integration** | Connect top-performing agents to real exchange APIs with user-funded accounts. | Extensive validation period. Auth system. Legal review. |
| **Score history sparklines** | Small inline chart per symbol showing score trajectory over 24h/7d. | Frontend-only change. |
| **Sector grouping** | Group symbols by sector and show sector-level bullish scores. | Symbol metadata table. |
| **Custom indicators** | Users define their own indicator logic. | Sandboxed computation. Auth. |
| **Alerts** | Notify when a symbol crosses a score threshold or an agent opens a trade. | Auth. Push/email infrastructure. |
| **API access** | Public REST API for rankings and agent data. | Rate limiting, API keys. |
| **Agent cloning** | Clone a top-performing agent's prompt and config as a starting point for a new agent. | UI for agent creation. |
| **Multi-exchange agents** | Agents trade across Binance, Bybit, OKX simultaneously. | Multi-exchange data ingestion. |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| OHLCV | Open, High, Low, Close, Volume -- standard candle data |
| Bullish score | Composite metric (0-1) indicating how many technical indicators suggest upward price movement |
| Confidence | Meta-metric (0-100) indicating how reliable the bullish score is |
| Highlight / Chip | Short text tag summarizing a notable indicator state |
| Snapshot | An immutable row representing one symbol's ranking data at a point in time |
| Agent | An autonomous Claude-powered trading entity with its own strategy, portfolio, and memory |
| Strategy archetype | The base trading philosophy of an agent (momentum, mean-reversion, breakout, swing) |
| Prompt evolution | The process by which an agent revises its own strategy prompt based on trading performance |
| Memory bank | An append-only log of trade reflections that agents reference for future decisions |
| Paper trading | Simulated trading with virtual money against real market prices |

## Appendix B: v1 Indicator Signal Rules Reference

| Indicator | Bullish | Neutral | Bearish |
|-----------|---------|---------|---------|
| **RSI (14)** | Crosses above 30 from below, or 50-70 | 40-50 | > 70 or < 30 and falling |
| **MACD (12,26,9)** | MACD > signal AND histogram increasing | Histogram near zero | MACD < signal AND histogram decreasing |
| **Stochastic (14,3,3)** | %K crosses above %D from below 20, or %K 50-80 with %K > %D | %K 20-80 with %K ~ %D | %K crosses below %D from above 80 |
| **ADX (14)** | ADX > 20 AND +DI > -DI | ADX < 20 | ADX > 20 AND -DI > +DI |
| **OBV** | Slope positive over 10 periods AND price slope positive | Flat or diverging | Slope negative over 10 periods |
| **Bollinger Bands (20,2)** | Bounced off lower band or riding upper with expanding width | Middle third | Rejected from upper or broke below lower |
| **EMA 20 vs Price** | Price > EMA 20 | Within 0.5% | Price < EMA 20 |
| **EMA 50 vs Price** | Price > EMA 50 | Within 1% | Price < EMA 50 |
| **EMA 200 vs Price** | Price > EMA 200 | Within 1.5% | Price < EMA 200 |

## Appendix C: Agent Strategy Archetypes (Initial Prompts)

Each archetype defines the base personality. The actual system prompts will be detailed during agent development, but the core philosophy per archetype:

| Archetype | Philosophy | Entry bias | Exit bias | Risk profile |
|-----------|-----------|------------|-----------|-------------|
| **Momentum** | Follow the trend. Buy strength, sell weakness. | Enter when multiple momentum indicators align bullish with strong trend (ADX > 25). | Exit when momentum fades (MACD histogram declining, RSI divergence). | Moderate. Wider stops. |
| **Mean Reversion** | Buy dips in uptrends, short rallies in downtrends. | Enter when price is oversold (RSI < 30, below lower BB) in a longer-term uptrend (above 200 EMA). | Exit on reversion to mean (price returns to 20 EMA). | Conservative. Tight stops. |
| **Breakout** | Trade range breaks. | Enter when price breaks above resistance with volume confirmation (OBV spike). | Exit on failed breakout (price returns inside range) or trailing stop. | Aggressive. Many small losses, few big wins. |
| **Swing** | Capture multi-candle swings using trend structure. | Enter on pullback to support in an uptrend (price touches 50 EMA in uptrend). | Exit at prior swing high or after N candles. | Conservative. Few trades, longer holds. |
