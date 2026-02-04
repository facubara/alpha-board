# Alpha Board -- Technical Specification

**Version:** 1.0
**Date:** 2026-02-04
**Status:** Draft
**Reference:** PRD v2.0

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Python Backend -- Module Architecture](#3-python-backend--module-architecture)
4. [Database Schema & Migrations](#4-database-schema--migrations)
5. [Rankings Pipeline](#5-rankings-pipeline)
6. [Agent Orchestrator](#6-agent-orchestrator)
7. [Agent Prompt Templates](#7-agent-prompt-templates)
8. [Agent Structured Output Schemas](#8-agent-structured-output-schemas)
9. [Next.js Frontend](#9-nextjs-frontend)
10. [Deployment & Infrastructure](#10-deployment--infrastructure)
11. [Environment Variables](#11-environment-variables)
12. [Error Handling & Recovery](#12-error-handling--recovery)
13. [Monitoring & Observability](#13-monitoring--observability)

---

## 1. System Overview

Two deployable units communicate exclusively via a shared PostgreSQL database:

| Component | Runtime | Host | Role |
|-----------|---------|------|------|
| `alpha-worker` | Python 3.12 | Fly.io | Data pipeline, indicator computation, agent orchestration |
| `alpha-web` | Next.js 15 (App Router) | Vercel | Read-only dashboard + agent prompt editing |

**Exception to read-only frontend:** The Next.js app writes to `agent_prompts` when a user edits an agent's strategy prompt. This is the only frontend write path.

```
alpha-board/
├── worker/          # Python backend (alpha-worker)
├── web/             # Next.js frontend (alpha-web)
├── migrations/      # Alembic database migrations
├── PRD.md
├── TECHNICAL_SPEC.md
└── .claude/
```

---

## 2. Repository Structure

### 2.1 Monorepo Layout

```
alpha-board/
│
├── worker/
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 001_initial_schema.py
│   │       ├── 002_agent_tables.py
│   │       └── ...
│   │
│   └── src/
│       ├── __init__.py
│       ├── main.py                  # Entrypoint: scheduler setup
│       ├── config.py                # Settings, env vars, constants
│       ├── db.py                    # Database connection, session factory
│       │
│       ├── exchange/
│       │   ├── __init__.py
│       │   ├── client.py            # Binance REST client
│       │   └── types.py             # Candle, Symbol DTOs
│       │
│       ├── indicators/
│       │   ├── __init__.py
│       │   ├── registry.py          # Indicator registration + dispatch
│       │   ├── compute.py           # Core computation (RSI, MACD, etc.)
│       │   ├── signals.py           # Signal normalization (bullish/neutral/bearish)
│       │   └── highlights.py        # Highlight chip generation
│       │
│       ├── scoring/
│       │   ├── __init__.py
│       │   ├── scorer.py            # Composite bullish score
│       │   ├── confidence.py        # Confidence score
│       │   └── ranker.py            # Rank symbols, produce snapshots
│       │
│       ├── agents/
│       │   ├── __init__.py
│       │   ├── orchestrator.py      # Main agent loop: schedule, dispatch, process
│       │   ├── context.py           # Build agent context (OHLCV + indicators + rankings)
│       │   ├── executor.py          # Call Claude API, parse structured output
│       │   ├── portfolio.py         # Portfolio/position management, SL/TP checks
│       │   ├── evolution.py         # Prompt evolution logic
│       │   ├── memory.py            # Memory bank read/write
│       │   └── schemas.py           # Pydantic models for agent actions
│       │
│       ├── pipeline/
│       │   ├── __init__.py
│       │   └── runner.py            # Orchestrates full ranking pipeline per timeframe
│       │
│       └── models/
│           ├── __init__.py
│           └── db.py                # SQLAlchemy ORM models
│
├── web/
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    # Rankings page (default)
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx                # Agent leaderboard
│   │   │   │   └── [agentId]/
│   │   │   │       └── page.tsx            # Agent detail page
│   │   │   └── api/
│   │   │       └── agents/
│   │   │           └── [agentId]/
│   │   │               └── prompt/
│   │   │                   └── route.ts    # POST: save prompt edit
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                         # shadcn/ui components
│   │   │   ├── rankings/
│   │   │   │   ├── rankings-table.tsx
│   │   │   │   ├── ranking-row.tsx
│   │   │   │   ├── indicator-breakdown.tsx
│   │   │   │   ├── highlight-chip.tsx
│   │   │   │   ├── timeframe-selector.tsx
│   │   │   │   └── score-bar.tsx
│   │   │   └── agents/
│   │   │       ├── agent-leaderboard.tsx
│   │   │       ├── agent-row.tsx
│   │   │       ├── agent-overview.tsx
│   │   │       ├── trade-history.tsx
│   │   │       ├── reasoning-log.tsx
│   │   │       ├── prompt-editor.tsx
│   │   │       ├── prompt-history.tsx
│   │   │       ├── model-config.tsx
│   │   │       └── equity-chart.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── db.ts                       # Postgres client (Neon serverless driver)
│   │   │   ├── queries/
│   │   │   │   ├── rankings.ts             # Ranking data queries
│   │   │   │   └── agents.ts               # Agent data queries
│   │   │   ├── types.ts                    # Shared TypeScript types
│   │   │   └── utils.ts                    # Formatting, helpers
│   │   │
│   │   └── hooks/
│   │       └── use-timeframe.ts            # Client-side timeframe state
│   │
│   └── public/
│
└── .claude/
    └── skills/
```

---

## 3. Python Backend -- Module Architecture

### 3.1 Dependencies

```toml
# pyproject.toml
[project]
name = "alpha-worker"
requires-python = ">=3.12"
dependencies = [
    "pandas>=2.2",
    "numpy>=1.26",
    "pandas-ta>=0.3",            # Technical indicators
    "psycopg[binary]>=3.1",      # PostgreSQL driver
    "sqlalchemy>=2.0",           # ORM
    "alembic>=1.13",             # Migrations
    "anthropic>=0.40",           # Claude API
    "httpx>=0.27",               # HTTP client (Binance API)
    "apscheduler>=3.10",         # Cron scheduling
    "fastapi>=0.115",            # Health checks + manual triggers
    "uvicorn>=0.32",             # ASGI server
    "pydantic>=2.9",             # Data validation
    "python-dotenv>=1.0",        # Env loading
]
```

### 3.2 Key Interfaces

#### `exchange/client.py`

```python
class BinanceClient:
    """Fetches market data from Binance REST API."""

    async def get_active_symbols(self, min_volume_usd: float = 1_000_000) -> list[Symbol]:
        """Return all USDT spot pairs above volume threshold."""

    async def get_klines(
        self, symbol: str, interval: str, limit: int = 200
    ) -> pd.DataFrame:
        """Fetch OHLCV candles. Returns DataFrame with columns:
        open_time, open, high, low, close, volume, close_time."""

    async def get_klines_batch(
        self, symbols: list[str], interval: str, limit: int = 200
    ) -> dict[str, pd.DataFrame]:
        """Fetch candles for multiple symbols with rate limiting."""
```

#### `indicators/registry.py`

```python
class IndicatorRegistry:
    """Manages registered indicators and dispatches computation."""

    def register(self, name: str, compute_fn: ComputeFn, signal_fn: SignalFn) -> None:
        """Register an indicator with its compute and signal normalization functions."""

    def compute_all(
        self, df: pd.DataFrame, active_indicators: list[IndicatorConfig]
    ) -> dict[str, IndicatorResult]:
        """Compute all active indicators for a single symbol's OHLCV data.
        Returns: {"rsi_14": {"value": 65.3, "signal": "bullish"}, ...}"""

    def generate_highlights(
        self, results: dict[str, IndicatorResult], df: pd.DataFrame
    ) -> list[str]:
        """Generate highlight tags from indicator results. Max 4."""
```

#### `scoring/scorer.py`

```python
class BullishScorer:
    """Computes composite bullish score from indicator signals."""

    def score(
        self,
        signals: dict[str, IndicatorResult],
        weights: dict[str, float],
    ) -> float:
        """Weighted average of signals, rescaled to [0, 1]."""

class ConfidenceScorer:
    """Computes confidence score from signal agreement, data quality, volume."""

    def score(
        self,
        signals: dict[str, IndicatorResult],
        total_expected: int,
        volume_percentile: float,
    ) -> int:
        """Returns confidence 0-100."""
```

#### `agents/orchestrator.py`

```python
class AgentOrchestrator:
    """Runs agent decision cycles triggered by candle closes."""

    async def run_cycle(self, timeframe: str) -> None:
        """Execute one decision cycle for all active agents on this timeframe.
        1. Load latest rankings + OHLCV for the timeframe
        2. For each active agent assigned to this timeframe:
           a. Build context (rankings, indicators, memory, open positions)
           b. Call Claude API with agent's active prompt
           c. Parse structured action response
           d. Execute action (open/close position, adjust SL/TP, hold)
           e. Log decision with full reasoning
        3. Check SL/TP triggers for all agents with open positions
        4. For agents that hit evolution threshold, trigger prompt evolution"""

    async def check_stop_loss_take_profit(self, candle_data: dict) -> None:
        """Evaluate all open positions against latest price data.
        Auto-close positions where SL or TP has been hit."""

    async def trigger_evolution(self, agent_id: int) -> None:
        """Run prompt evolution for an agent that has crossed the trade threshold."""
```

#### `agents/executor.py`

```python
class AgentExecutor:
    """Handles Claude API calls for agent decisions."""

    async def decide(
        self,
        agent: Agent,
        system_prompt: str,
        context: AgentContext,
        model: str,
    ) -> AgentDecision:
        """Call Claude with tool_use for structured trade actions.
        Returns parsed decision with action, params, and full reasoning."""

    async def evolve_prompt(
        self,
        agent: Agent,
        current_prompt: str,
        performance: PerformanceStats,
        recent_trades: list[Trade],
        model: str,
    ) -> PromptEvolution:
        """Ask Claude to review and revise the agent's strategy prompt.
        Returns new prompt text + diff."""

    async def generate_memory(
        self,
        agent: Agent,
        trade: Trade,
        model: str,
    ) -> str:
        """Generate a 1-3 sentence reflection on a completed trade."""
```

#### `agents/portfolio.py`

```python
class PortfolioManager:
    """Manages virtual portfolios, positions, and PnL calculations."""

    FEE_RATE = 0.001  # 0.1% per trade (entry + exit)
    MAX_POSITION_PCT = 0.25  # Max 25% of portfolio per position
    MAX_CONCURRENT_POSITIONS = 5

    def open_position(
        self, agent_id: int, symbol_id: int, direction: str,
        size: float, entry_price: float,
        stop_loss: float | None, take_profit: float | None,
    ) -> Position:
        """Validate constraints and open a new position."""

    def close_position(
        self, position_id: int, exit_price: float, reason: str,
    ) -> Trade:
        """Close position, calculate PnL, update portfolio."""

    def update_unrealized_pnl(
        self, agent_id: int, current_prices: dict[int, float],
    ) -> None:
        """Update unrealized PnL for all open positions."""

    def get_portfolio_summary(self, agent_id: int) -> PortfolioSummary:
        """Cash, equity, open positions, realized PnL, fees paid."""
```

#### `pipeline/runner.py`

```python
class PipelineRunner:
    """Orchestrates the full ranking + agent pipeline."""

    async def run(self, timeframe: str) -> None:
        """Full pipeline for one timeframe:
        1. Fetch OHLCV for all active symbols
        2. Compute indicators
        3. Score and rank
        4. Persist snapshots
        5. Run agent decision cycle (if candle just closed)
        """

    async def should_run_agents(self, timeframe: str) -> bool:
        """Check if a candle just closed for this timeframe.
        Agents only decide on candle close, not mid-candle."""
```

#### `main.py`

```python
"""Entrypoint. Runs both the scheduler and a minimal FastAPI server."""

# FastAPI endpoints:
# GET  /health              -> {"status": "ok", "last_run": {...}}
# GET  /status              -> Current run status per timeframe
# POST /trigger/{timeframe} -> Manually trigger a pipeline run (dev/debug)

# Scheduler:
# Runs every 5 minutes. Checks which timeframes are due.
# Uses APScheduler with PostgreSQL job store for persistence.
```

---

## 4. Database Schema & Migrations

### 4.1 Migration Strategy

Alembic manages all schema changes. Migrations run automatically on deployment via the Dockerfile entrypoint.

```
alembic/versions/
  001_initial_schema.py       # symbols, snapshots, indicators, computation_runs
  002_agent_tables.py         # agents, agent_prompts, agent_portfolios,
                              # agent_positions, agent_trades, agent_decisions,
                              # agent_memory, agent_token_usage
  003_seed_agents.py          # Insert 28 agents with initial prompts
```

### 4.2 Full Schema DDL

```sql
-- 001: Core ranking tables

CREATE TABLE symbols (
    id          SERIAL PRIMARY KEY,
    symbol      VARCHAR(20) NOT NULL UNIQUE,
    base_asset  VARCHAR(10) NOT NULL,
    quote_asset VARCHAR(10) NOT NULL DEFAULT 'USDT',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE indicators (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(30) NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    category     VARCHAR(20) NOT NULL,
    weight       NUMERIC(3,2) NOT NULL DEFAULT 0.10,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    config       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE computation_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timeframe     VARCHAR(4) NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at   TIMESTAMPTZ,
    symbol_count  SMALLINT,
    status        VARCHAR(10) NOT NULL DEFAULT 'running',
    error_message TEXT
);

CREATE TABLE snapshots (
    id                BIGSERIAL PRIMARY KEY,
    symbol_id         INT NOT NULL REFERENCES symbols(id),
    timeframe         VARCHAR(4) NOT NULL,
    bullish_score     NUMERIC(4,3) NOT NULL,
    confidence        SMALLINT NOT NULL,
    rank              SMALLINT NOT NULL,
    highlights        JSONB NOT NULL DEFAULT '[]',
    indicator_signals JSONB NOT NULL DEFAULT '{}',
    computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id            UUID NOT NULL REFERENCES computation_runs(id)
) PARTITION BY RANGE (computed_at);

-- Create partitions for first 3 months
CREATE TABLE snapshots_2026_02 PARTITION OF snapshots
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE snapshots_2026_03 PARTITION OF snapshots
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE snapshots_2026_04 PARTITION OF snapshots
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX idx_snapshots_tf_time ON snapshots (timeframe, computed_at DESC);
CREATE INDEX idx_snapshots_symbol_tf_time ON snapshots (symbol_id, timeframe, computed_at DESC);
CREATE INDEX idx_snapshots_run ON snapshots (run_id);

-- 002: Agent tables

CREATE TABLE agents (
    id                        SERIAL PRIMARY KEY,
    name                      VARCHAR(50) NOT NULL UNIQUE,
    display_name              VARCHAR(100) NOT NULL,
    strategy_archetype        VARCHAR(20) NOT NULL,
    timeframe                 VARCHAR(10) NOT NULL,
    scan_model                VARCHAR(50) NOT NULL DEFAULT 'claude-haiku-3-5-20241022',
    trade_model               VARCHAR(50) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    evolution_model           VARCHAR(50) NOT NULL DEFAULT 'claude-opus-4-5-20251101',
    status                    VARCHAR(10) NOT NULL DEFAULT 'active',
    initial_balance           NUMERIC(12,2) NOT NULL DEFAULT 10000.00,
    evolution_trade_threshold SMALLINT NOT NULL DEFAULT 10,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_prompts (
    id                     SERIAL PRIMARY KEY,
    agent_id               INT NOT NULL REFERENCES agents(id),
    version                SMALLINT NOT NULL,
    system_prompt          TEXT NOT NULL,
    source                 VARCHAR(10) NOT NULL, -- 'initial', 'auto', 'human'
    diff_from_previous     TEXT,
    performance_at_change  JSONB,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active              BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(agent_id, version)
);

CREATE INDEX idx_agent_prompts_active ON agent_prompts (agent_id) WHERE is_active = true;

CREATE TABLE agent_portfolios (
    agent_id            INT PRIMARY KEY REFERENCES agents(id),
    cash_balance        NUMERIC(14,2) NOT NULL,
    total_equity        NUMERIC(14,2) NOT NULL,
    total_realized_pnl  NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_fees_paid     NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_positions (
    id              SERIAL PRIMARY KEY,
    agent_id        INT NOT NULL REFERENCES agents(id),
    symbol_id       INT NOT NULL REFERENCES symbols(id),
    direction       VARCHAR(5) NOT NULL,
    entry_price     NUMERIC(18,8) NOT NULL,
    position_size   NUMERIC(14,2) NOT NULL,
    stop_loss       NUMERIC(18,8),
    take_profit     NUMERIC(18,8),
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    unrealized_pnl  NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_agent_positions_agent ON agent_positions (agent_id);

CREATE TABLE agent_decisions (
    id                  BIGSERIAL PRIMARY KEY,
    agent_id            INT NOT NULL REFERENCES agents(id),
    action              VARCHAR(20) NOT NULL,
    symbol_id           INT REFERENCES symbols(id),
    reasoning_full      TEXT NOT NULL,
    reasoning_summary   VARCHAR(500) NOT NULL,
    action_params       JSONB,
    model_used          VARCHAR(50) NOT NULL,
    input_tokens        INT NOT NULL,
    output_tokens       INT NOT NULL,
    estimated_cost_usd  NUMERIC(8,4) NOT NULL,
    prompt_version      SMALLINT NOT NULL,
    decided_at          TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (decided_at);

CREATE TABLE agent_decisions_2026_02 PARTITION OF agent_decisions
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE agent_decisions_2026_03 PARTITION OF agent_decisions
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE agent_decisions_2026_04 PARTITION OF agent_decisions
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX idx_agent_decisions_agent_time ON agent_decisions (agent_id, decided_at DESC);

CREATE TABLE agent_trades (
    id                BIGSERIAL PRIMARY KEY,
    agent_id          INT NOT NULL REFERENCES agents(id),
    symbol_id         INT NOT NULL REFERENCES symbols(id),
    direction         VARCHAR(5) NOT NULL,
    entry_price       NUMERIC(18,8) NOT NULL,
    exit_price        NUMERIC(18,8) NOT NULL,
    position_size     NUMERIC(14,2) NOT NULL,
    pnl               NUMERIC(14,2) NOT NULL,
    fees              NUMERIC(10,2) NOT NULL,
    exit_reason       VARCHAR(20) NOT NULL,
    opened_at         TIMESTAMPTZ NOT NULL,
    closed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes  INT NOT NULL,
    decision_id       BIGINT REFERENCES agent_decisions(id),
    close_decision_id BIGINT REFERENCES agent_decisions(id)
);

CREATE INDEX idx_agent_trades_agent_time ON agent_trades (agent_id, closed_at DESC);

CREATE TABLE agent_memory (
    id         BIGSERIAL PRIMARY KEY,
    agent_id   INT NOT NULL REFERENCES agents(id),
    trade_id   BIGINT NOT NULL REFERENCES agent_trades(id),
    lesson     TEXT NOT NULL,
    tags       JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_memory_agent_time ON agent_memory (agent_id, created_at DESC);

CREATE TABLE agent_token_usage (
    id                 SERIAL PRIMARY KEY,
    agent_id           INT NOT NULL REFERENCES agents(id),
    model              VARCHAR(50) NOT NULL,
    task_type          VARCHAR(15) NOT NULL,
    date               DATE NOT NULL,
    input_tokens       BIGINT NOT NULL DEFAULT 0,
    output_tokens      BIGINT NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
    UNIQUE(agent_id, model, task_type, date)
);

CREATE INDEX idx_agent_token_usage_agent_date ON agent_token_usage (agent_id, date DESC);
```

### 4.3 Seed Data: 28 Agents

```sql
-- 003: Seed agents
-- Pattern: 4 archetypes x 6 timeframes + 4 cross-timeframe

-- Timeframe-specific agents (24 total)
INSERT INTO agents (name, display_name, strategy_archetype, timeframe) VALUES
-- 15m
('momentum-15m',       'Momentum Trader (15m)',       'momentum',       '15m'),
('meanrev-15m',        'Mean Reversion (15m)',        'mean_reversion', '15m'),
('breakout-15m',       'Breakout Hunter (15m)',       'breakout',       '15m'),
('swing-15m',          'Swing Trader (15m)',          'swing',          '15m'),
-- 30m
('momentum-30m',       'Momentum Trader (30m)',       'momentum',       '30m'),
('meanrev-30m',        'Mean Reversion (30m)',        'mean_reversion', '30m'),
('breakout-30m',       'Breakout Hunter (30m)',       'breakout',       '30m'),
('swing-30m',          'Swing Trader (30m)',          'swing',          '30m'),
-- 1h
('momentum-1h',        'Momentum Trader (1H)',        'momentum',       '1h'),
('meanrev-1h',         'Mean Reversion (1H)',         'mean_reversion', '1h'),
('breakout-1h',        'Breakout Hunter (1H)',        'breakout',       '1h'),
('swing-1h',           'Swing Trader (1H)',           'swing',          '1h'),
-- 4h
('momentum-4h',        'Momentum Trader (4H)',        'momentum',       '4h'),
('meanrev-4h',         'Mean Reversion (4H)',         'mean_reversion', '4h'),
('breakout-4h',        'Breakout Hunter (4H)',        'breakout',       '4h'),
('swing-4h',           'Swing Trader (4H)',           'swing',          '4h'),
-- 1d
('momentum-1d',        'Momentum Trader (1D)',        'momentum',       '1d'),
('meanrev-1d',         'Mean Reversion (1D)',         'mean_reversion', '1d'),
('breakout-1d',        'Breakout Hunter (1D)',        'breakout',       '1d'),
('swing-1d',           'Swing Trader (1D)',           'swing',          '1d'),
-- 1w
('momentum-1w',        'Momentum Trader (1W)',        'momentum',       '1w'),
('meanrev-1w',         'Mean Reversion (1W)',         'mean_reversion', '1w'),
('breakout-1w',        'Breakout Hunter (1W)',        'breakout',       '1w'),
('swing-1w',           'Swing Trader (1W)',           'swing',          '1w');

-- Cross-timeframe agents (4 total)
INSERT INTO agents (name, display_name, strategy_archetype, timeframe) VALUES
('cross-confluence',    'Multi-TF Confluence',         'momentum',       'cross'),
('cross-divergence',    'Multi-TF Divergence',         'mean_reversion', 'cross'),
('cross-cascade',       'Timeframe Cascade',           'breakout',       'cross'),
('cross-regime',        'Regime Detector',             'swing',          'cross');

-- Initialize portfolios for all agents
INSERT INTO agent_portfolios (agent_id, cash_balance, total_equity)
SELECT id, initial_balance, initial_balance FROM agents;
```

---

## 5. Rankings Pipeline

### 5.1 Execution Flow

```
Scheduler (every 5 min)
│
├─ Check which timeframes are due (based on cadence + last computation_run)
│
├─ For each due timeframe:
│   │
│   ├─ 1. Acquire advisory lock (pg_try_advisory_lock)
│   │     └─ If locked, skip (another run in progress)
│   │
│   ├─ 2. Create computation_run row (status: 'running')
│   │
│   ├─ 3. Fetch active symbols from DB
│   │
│   ├─ 4. Fetch OHLCV from Binance (batched, rate-limited)
│   │     └─ 200 symbols × 200 candles each
│   │     └─ Batch size: 10 concurrent requests
│   │     └─ Rate limit: 1200 req/min (Binance limit)
│   │
│   ├─ 5. For each symbol:
│   │     ├─ Compute all active indicators
│   │     ├─ Normalize to signals
│   │     ├─ Generate highlights
│   │     ├─ Compute bullish score
│   │     └─ Compute confidence score
│   │
│   ├─ 6. Rank all symbols by score DESC, confidence DESC
│   │
│   ├─ 7. Bulk INSERT snapshots (one row per symbol)
│   │
│   ├─ 8. Update computation_run (status: 'completed')
│   │
│   ├─ 9. If candle just closed for this timeframe:
│   │     └─ Trigger agent decision cycle (see §6)
│   │
│   └─ 10. Release advisory lock
│
└─ Check SL/TP for all agents with open positions (every cycle)
```

### 5.2 Candle Close Detection

An agent decision cycle only triggers when a candle has closed since the last agent run for that timeframe.

```python
def has_candle_closed(timeframe: str, last_agent_run: datetime) -> bool:
    """Check if a new candle has closed since the last agent run.

    Binance candle close times:
    - 15m: :00, :15, :30, :45
    - 30m: :00, :30
    - 1h:  :00
    - 4h:  00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
    - 1d:  00:00 UTC
    - 1w:  Monday 00:00 UTC
    """
    now = datetime.now(timezone.utc)
    last_close = get_last_candle_close(timeframe, now)
    return last_close > last_agent_run
```

### 5.3 Indicator Computation Detail

Each indicator function receives a pandas DataFrame with OHLCV columns and returns a raw numeric value. The signal normalization function then maps this to `bullish`/`neutral`/`bearish`.

```python
# Example: RSI computation + signal
def compute_rsi(df: pd.DataFrame, period: int = 14) -> float:
    """Returns current RSI value (0-100)."""
    return pandas_ta.rsi(df["close"], length=period).iloc[-1]

def signal_rsi(value: float, config: dict) -> str:
    """Normalize RSI to signal. Config contains thresholds."""
    if value < config.get("oversold", 30):
        # Check if crossing up from oversold
        return "bullish"  # Reversal signal
    elif 50 <= value <= 70:
        return "bullish"  # Momentum zone
    elif 40 <= value < 50:
        return "neutral"
    elif value > 70:
        return "bearish"  # Overbought
    else:
        return "neutral"
```

---

## 6. Agent Orchestrator

### 6.1 Decision Cycle Flow

```
Agent Decision Cycle (triggered per timeframe on candle close)
│
├─ 1. Load latest ranking snapshot for this timeframe
│
├─ 2. Load recent OHLCV data (last 50 candles) for context
│
├─ 3. For each active agent assigned to this timeframe (sequential):
│   │
│   ├─ a. Load agent config (models, status, prompt)
│   │     └─ Skip if status == 'paused'
│   │
│   ├─ b. Load active prompt (latest where is_active = true)
│   │
│   ├─ c. Load open positions for this agent
│   │
│   ├─ d. Load memory bank (last 20 entries)
│   │
│   ├─ e. Build context object:
│   │     {
│   │       rankings: top 30 + bottom 10 symbols,
│   │       ohlcv: last 20 candles for symbols with open positions
│   │              + top 10 ranked symbols,
│   │       indicators: full signal breakdown for context symbols,
│   │       portfolio: current cash, equity, open positions,
│   │       memory: last 20 trade reflections,
│   │       timestamp: current UTC time,
│   │     }
│   │
│   ├─ f. Call Claude API (tool_use):
│   │     model: agent.trade_model
│   │     system: agent's active strategy prompt
│   │     user: structured context (above)
│   │     tools: [trade_action tool definition]
│   │
│   ├─ g. Parse structured response:
│   │     └─ Extract tool_use call → AgentAction
│   │     └─ Extract text content → reasoning_full
│   │     └─ Generate reasoning_summary (first 1-2 sentences of reasoning)
│   │
│   ├─ h. Validate action:
│   │     └─ Position size <= 25% of portfolio
│   │     └─ Concurrent positions <= 5
│   │     └─ Sufficient cash balance
│   │     └─ Symbol exists and is active
│   │     └─ If invalid: log as 'hold' with validation error in reasoning
│   │
│   ├─ i. Execute action:
│   │     └─ open_long/open_short: create position, deduct cash
│   │     └─ close_position: close position, calculate PnL, update portfolio
│   │     └─ adjust_stop_loss/adjust_take_profit: update position
│   │     └─ hold: no portfolio change
│   │
│   ├─ j. Log decision to agent_decisions table
│   │
│   ├─ k. Track token usage in agent_token_usage
│   │
│   └─ l. If a trade was closed:
│         ├─ Generate memory entry (using scan_model for cost efficiency)
│         ├─ Check if evolution_trade_threshold reached
│         └─ If threshold reached: queue evolution (runs after all agents)
│
├─ 4. Run queued prompt evolutions (sequential):
│   ├─ Load agent's current prompt + recent performance stats
│   ├─ Call Claude (evolution_model) with meta-prompt
│   ├─ Save new prompt version (source: 'auto')
│   ├─ Deactivate old prompt, activate new one
│   └─ If PnL dropped >20% since last evolution: auto-revert, flag for review
│
└─ 5. Update unrealized PnL for all open positions
```

### 6.2 Cross-Timeframe Agent Context

Cross-timeframe agents receive an enriched context:

```python
cross_tf_context = {
    "rankings_by_timeframe": {
        "15m": top_20_symbols,
        "30m": top_20_symbols,
        "1h":  top_20_symbols,
        "4h":  top_20_symbols,
        "1d":  top_20_symbols,
        "1w":  top_20_symbols,
    },
    "confluence_symbols": [
        # Symbols that appear in top 20 across 3+ timeframes
        {"symbol": "BTCUSDT", "timeframes_bullish": ["1h", "4h", "1d"], "avg_score": 0.82},
    ],
    "divergence_symbols": [
        # Symbols bullish on short TFs but bearish on long TFs (or vice versa)
        {"symbol": "ETHUSDT", "short_tf_score": 0.85, "long_tf_score": 0.25},
    ],
    "portfolio": { ... },
    "memory": [ ... ],
}
```

### 6.3 Token Usage Tracking

```python
async def track_usage(
    agent_id: int,
    model: str,
    task_type: str,  # 'scan', 'trade', 'evolution'
    response: anthropic.Message,
) -> None:
    """Upsert daily token usage aggregation."""
    cost = estimate_cost(model, response.usage.input_tokens, response.usage.output_tokens)

    # UPSERT into agent_token_usage
    # ON CONFLICT (agent_id, model, task_type, date) DO UPDATE
    #   SET input_tokens = input_tokens + excluded.input_tokens, ...
```

### 6.4 Cost Estimation

```python
# Pricing as of 2025 (update when Anthropic changes pricing)
MODEL_PRICING = {
    "claude-haiku-3-5-20241022":  {"input": 0.80,  "output": 4.00},   # per 1M tokens
    "claude-sonnet-4-20250514":   {"input": 3.00,  "output": 15.00},
    "claude-opus-4-5-20251101":   {"input": 15.00, "output": 75.00},
}

def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate cost in USD."""
    pricing = MODEL_PRICING.get(model, MODEL_PRICING["claude-sonnet-4-20250514"])
    return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
```

---

## 7. Agent Prompt Templates

### 7.1 System Prompt Structure (shared by all agents)

Every agent's system prompt follows this structure. The `{STRATEGY_SECTION}` varies per archetype.

```
You are a crypto trading agent operating on the {TIMEFRAME} timeframe with a simulated portfolio.

## Your Role
You analyze market data and make trading decisions (long/short) for USDT-quoted cryptocurrency pairs on Binance. All trading is simulated with virtual funds. You aim to maximize risk-adjusted returns.

## Your Strategy
{STRATEGY_SECTION}

## Portfolio Rules (enforced by the system -- you cannot override these)
- Maximum position size: 25% of portfolio value
- Maximum concurrent open positions: 5
- Trading fees: 0.1% per trade (entry and exit)
- Stop-losses and take-profits are monitored every candle

## Decision Framework
For each decision cycle, you will receive:
1. Current portfolio state (cash, open positions, equity)
2. Bullish rankings for your timeframe (top and bottom symbols with scores and confidence)
3. Individual indicator signals for key symbols
4. Recent OHLCV candle data
5. Your memory of past trades and lessons

You must use the `trade_action` tool to declare your action. You may take exactly ONE action per cycle. Think carefully before acting -- holding is a valid and often correct decision.

## Reasoning Requirements
Before calling the tool, explain your reasoning:
1. What is the current market context? (trending, ranging, volatile?)
2. Which symbols stand out and why?
3. How do your open positions factor in?
4. What does your memory tell you about similar setups?
5. What is your action and why?

Be specific. Reference actual indicator values and scores. Avoid generic statements.
```

### 7.2 Momentum Trader Strategy

```
## Your Strategy: Momentum Trading

You follow the trend. Your core belief: strong moves tend to continue. You buy strength and sell weakness.

### Entry Criteria (Long)
- Bullish score >= 0.70 with confidence >= 60
- RSI between 50-70 (momentum zone, NOT overbought)
- MACD histogram positive and increasing
- ADX > 25 (strong trend) with +DI > -DI
- Price above EMA 50 and EMA 200
- OBV confirming (positive slope)

### Entry Criteria (Short)
- Bullish score <= 0.30 with confidence >= 60
- RSI between 30-50 (bearish momentum zone)
- MACD histogram negative and decreasing
- ADX > 25 with -DI > +DI
- Price below EMA 50 and EMA 200

### Exit Rules
- Exit longs when: MACD histogram starts declining for 2+ candles, OR RSI > 75 (overbought), OR price closes below EMA 20
- Exit shorts when: MACD histogram starts rising for 2+ candles, OR RSI < 25 (oversold), OR price closes above EMA 20
- Always set a stop-loss at 2x ATR below entry (longs) or above entry (shorts)
- Take-profit at 3x the stop-loss distance (1.5:1 risk-reward minimum)

### Position Sizing
- Base size: 15% of portfolio for high-confidence setups (confidence >= 75)
- Reduced size: 8% for moderate setups (confidence 60-74)
- Never enter below confidence 60

### What To Avoid
- Don't chase: if a symbol has already moved 5%+ in your direction in the last 3 candles, you've missed the entry
- Don't fight the trend: never long when price is below EMA 200, never short when price is above EMA 200
- Don't overtrade: if you have 3+ open positions, be very selective about adding more
```

### 7.3 Mean Reversion Trader Strategy

```
## Your Strategy: Mean Reversion Trading

You buy dips in uptrends and short rallies in downtrends. Your core belief: extreme moves revert to the mean. You are a contrarian within the larger trend context.

### Entry Criteria (Long)
- Price is in a larger uptrend (above EMA 200)
- BUT price is temporarily oversold: RSI < 30, or price at/below lower Bollinger Band
- Stochastic %K crosses above %D from below 20
- Bullish score is low (0.20-0.45) because short-term indicators are bearish, but you see this as opportunity in context of the longer trend
- Volume is declining during the pullback (healthy retracement, not panic selling)

### Entry Criteria (Short)
- Price is in a larger downtrend (below EMA 200)
- BUT price is temporarily overbought: RSI > 70, or price at/above upper Bollinger Band
- Stochastic %K crosses below %D from above 80
- Price has bounced into EMA 50 from below (resistance test)

### Exit Rules
- Exit longs when: price returns to EMA 20 (mean), OR RSI returns to 50-60 zone
- Exit shorts when: price returns to EMA 20, OR RSI returns to 40-50 zone
- Stop-loss: just below the recent swing low (longs) or above the recent swing high (shorts). Typically 1-1.5x ATR.
- Take-profit: at EMA 20 (conservative) or EMA 50 (aggressive). Never hold for trend continuation -- that's not your strategy.

### Position Sizing
- Base size: 10% of portfolio (mean reversion is riskier -- you're buying against momentum)
- Scale in: if price drops another 2% after initial entry (and still above EMA 200), add 5% more
- Maximum 2 positions in the same direction

### What To Avoid
- Never try to catch a falling knife: if price is below EMA 200 AND RSI < 30, the trend may be breaking, not reverting
- Don't hold through the mean: once price hits the mean (EMA 20), take profit. Greed kills mean reversion strategies.
- Don't average down more than once. If the second entry is also losing, the thesis is wrong.
```

### 7.4 Breakout Trader Strategy

```
## Your Strategy: Breakout Trading

You trade range breaks with volume confirmation. Your core belief: when price consolidates and then breaks out with volume, a significant move follows. You accept many small losses for occasional large wins.

### Entry Criteria (Long)
- Bollinger Bands have been squeezing (bandwidth in bottom 20th percentile of recent history)
- Price breaks above the upper Bollinger Band with a strong candle (close near the high)
- Volume spike: OBV shows a sharp increase (2+ standard deviations above recent average)
- ADX is rising from below 20 (trend emerging from consolidation)
- Bullish score is transitioning: was below 0.50 recently, now crossing above 0.60

### Entry Criteria (Short)
- Same Bollinger squeeze conditions
- Price breaks below lower Bollinger Band with a strong bearish candle
- Volume confirmation on the breakdown
- ADX rising with -DI > +DI

### Exit Rules
- Use a trailing stop-loss: initially set at the opposite Bollinger Band, then trail at 1.5x ATR below the highest close since entry
- No fixed take-profit: let winners run. The whole strategy depends on capturing large moves.
- Exit if the breakout fails: price re-enters the Bollinger Bands within 3 candles after breaking out (false breakout)
- Maximum hold time: 20 candles. If the move hasn't extended by then, it's not the breakout you wanted.

### Position Sizing
- Base size: 8% of portfolio (expect a ~40% win rate, size accordingly)
- Never add to a breakout position. The entry is the edge -- adding later dilutes it.

### What To Avoid
- Don't enter breakouts without volume confirmation. Price-only breakouts fail more often than they succeed.
- Don't re-enter immediately after a false breakout stop-out. Wait for a new squeeze to form.
- Don't trade breakouts when ADX is already above 40 (the trend is already mature, not emerging)
- Be very selective: you should only take 1-2 trades per cycle of 10+ candle evaluations
```

### 7.5 Swing Trader Strategy

```
## Your Strategy: Swing Trading

You capture multi-candle swings in trending markets. Your core belief: trends move in waves, and you can enter on pullbacks within the trend. You are patient and selective.

### Entry Criteria (Long)
- Clear uptrend: price above EMA 50, EMA 50 above EMA 200, both EMAs sloping up
- Price pulls back to a support level: touches EMA 50, or previous swing low, or 0.618 Fibonacci retracement
- Bullish score >= 0.55 with confidence >= 65 (moderate -- you don't need extreme readings)
- RSI between 40-55 (pulled back from overbought but not oversold)
- Stochastic showing signs of turning up from below 50

### Entry Criteria (Short)
- Clear downtrend: price below EMA 50, EMA 50 below EMA 200
- Price rallies to resistance: touches EMA 50 from below, or previous swing high
- RSI between 45-60 (rallied from oversold but not overbought)

### Exit Rules
- Take profit at the previous swing high (longs) or swing low (shorts)
- Alternative exit: when RSI reaches 70+ (longs) or 30- (shorts)
- Stop-loss: below the pullback low + 0.5x ATR buffer (longs), above pullback high + 0.5x ATR (shorts)
- Time-based exit: if the position hasn't reached the target within 10 candles, reassess. Close if the trend structure is weakening.

### Position Sizing
- Base size: 20% of portfolio (high conviction, well-defined risk)
- Reduced to 12% if confidence is below 70
- Maximum 3 concurrent positions

### What To Avoid
- Don't enter mid-swing: wait for the pullback. Entering when price is already extended reduces your risk-reward.
- Don't hold through trend breaks: if price closes below EMA 200 (longs) or above EMA 200 (shorts), exit immediately regardless of stop-loss.
- Don't trade during range-bound markets (ADX < 20). Swing trading requires a trend.
- Patience is everything: you should have many `hold` cycles between trades. Trading 1-3 times per 20 candle evaluations is normal.
```

### 7.6 Cross-Timeframe Agent Strategies

#### Multi-TF Confluence

```
## Your Strategy: Multi-Timeframe Confluence

You only trade when multiple timeframes agree. Your core belief: the strongest moves happen when short-term, medium-term, and long-term signals align. You sacrifice frequency for quality.

### Entry Criteria (Long)
- Symbol appears in top 20 bullish rankings across 3+ timeframes
- The 1D or 1W timeframe shows bullish (score >= 0.60) -- this is your trend filter
- At least one short timeframe (15m, 30m, or 1h) shows a fresh bullish signal (score increased in latest snapshot)
- Average bullish score across all timeframes >= 0.65

### Entry Criteria (Short)
- Symbol appears in bottom 20 across 3+ timeframes
- 1D or 1W shows bearish (score <= 0.40)
- Short timeframe shows fresh bearish signal
- Average score across all timeframes <= 0.35

### Exit Rules
- Exit when timeframe agreement breaks: if the symbol drops out of the top 30 on any 2 timeframes, close.
- Take profit: 3x ATR(1D) from entry
- Stop loss: 1.5x ATR(1D) from entry

### Position Sizing
- 18% of portfolio. These are high-conviction trades.
- Maximum 3 concurrent positions

### What To Avoid
- Never trade symbols that are bullish on short timeframes but bearish on 1D/1W. Short-term noise in a long-term downtrend.
- Don't enter if the confluence is formed by stale data (check that rankings are recent across all timeframes).
```

#### Multi-TF Divergence

```
## Your Strategy: Multi-Timeframe Divergence

You find symbols where short-term and long-term signals disagree, and trade the reversion. Your core belief: when short-term momentum diverges from the long-term trend, the long-term trend usually wins.

### Entry Criteria (Long)
- Long-term bullish: 1D and 1W scores >= 0.60
- Short-term bearish: 15m or 1h score <= 0.35 (temporary pullback)
- This divergence suggests a buying opportunity in a larger uptrend

### Entry Criteria (Short)
- Long-term bearish: 1D and 1W scores <= 0.40
- Short-term bullish: 15m or 1h score >= 0.65 (temporary bounce)
- This divergence suggests a shorting opportunity in a larger downtrend

### Exit Rules
- Exit when short-term scores realign with long-term (divergence resolved)
- Stop-loss: if the long-term trend also turns against you (1D score crosses 0.50 against your direction)

### Position Sizing
- 10% of portfolio (divergence plays are inherently riskier)
- Maximum 4 concurrent positions
```

#### Timeframe Cascade

```
## Your Strategy: Timeframe Cascade

You look for signals that cascade from longer to shorter timeframes. Your core belief: major moves start on higher timeframes and propagate down. By detecting the cascade early, you catch moves before they're fully priced in on short timeframes.

### Entry Criteria (Long)
- 1W score just turned bullish (was <= 0.50, now >= 0.60) in a recent snapshot
- 1D score is also bullish (>= 0.55) -- cascade has begun
- 4H or 1H score is still neutral or bearish (<= 0.50) -- cascade hasn't fully propagated
- You are betting that the shorter timeframes will follow

### Entry Criteria (Short)
- Inverse: 1W turned bearish, 1D confirms, 4H/1H haven't caught up yet

### Exit Rules
- Exit when the cascade completes (1H score aligns with 1D/1W) -- the opportunity is priced in
- Stop-loss: if 1W score reverts back below 0.50 (false signal)

### Position Sizing
- 12% of portfolio
- Maximum 3 concurrent positions
```

#### Regime Detector

```
## Your Strategy: Market Regime Detection

You identify market regime changes and position accordingly. Your core belief: markets alternate between trending and ranging regimes. Detecting the shift early is more valuable than any individual signal.

### Regime Definitions
- **Trending Bull**: 4+ timeframes have ADX > 25 and bullish scores > 0.60
- **Trending Bear**: 4+ timeframes have ADX > 25 and bullish scores < 0.40
- **Ranging**: Most timeframes have ADX < 20
- **Transitioning**: Mixed signals -- some timeframes trending, others ranging

### Entry Criteria
- Enter long when regime shifts from Ranging → Trending Bull. Pick the top 3 symbols by cross-TF average score.
- Enter short when regime shifts from Ranging → Trending Bear. Pick the bottom 3 symbols.
- Do NOT trade during Ranging or Transitioning regimes. Hold cash.

### Exit Rules
- Exit all positions when regime shifts to Ranging or Transitioning
- No individual stop-losses. This is a regime-level strategy -- you exit when the regime changes, not on individual symbol moves.
- Exception: exit a single position if it drops more than 5% (hard risk limit)

### Position Sizing
- 15% per position, max 3 positions = max 45% deployed
- 55%+ always in cash waiting for regime shifts

### What To Avoid
- Don't trade in ranging markets. Your win rate in ranges will be near zero.
- Don't second-guess the regime classification. Trust the cross-timeframe ADX signal.
- Regime shifts are rare events. You may go many cycles without a trade. That's correct behavior.
```

---

## 8. Agent Structured Output Schemas

### 8.1 Tool Definition (sent to Claude API)

```json
{
  "name": "trade_action",
  "description": "Declare your trading action for this decision cycle. You must call this tool exactly once. Choose the action that best fits your analysis. 'hold' is a valid and often correct action.",
  "input_schema": {
    "type": "object",
    "required": ["action"],
    "properties": {
      "action": {
        "type": "string",
        "enum": ["open_long", "open_short", "close_position", "adjust_stop_loss", "adjust_take_profit", "hold"],
        "description": "The trading action to take."
      },
      "symbol": {
        "type": "string",
        "description": "The trading pair symbol (e.g., 'BTCUSDT'). Required for all actions except 'hold'."
      },
      "position_size_usdt": {
        "type": "number",
        "description": "Position size in USDT. Required for 'open_long' and 'open_short'. Must be <= 25% of portfolio value."
      },
      "stop_loss_price": {
        "type": "number",
        "description": "Stop-loss price. Required for 'open_long' and 'open_short'. For 'adjust_stop_loss', this is the new stop-loss."
      },
      "take_profit_price": {
        "type": "number",
        "description": "Take-profit price. Optional for 'open_long' and 'open_short'. For 'adjust_take_profit', this is the new take-profit."
      },
      "position_id": {
        "type": "integer",
        "description": "ID of the position to close or adjust. Required for 'close_position', 'adjust_stop_loss', 'adjust_take_profit'."
      },
      "confidence": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "description": "Your confidence in this decision (0-100). Be honest -- this is tracked for calibration."
      },
      "reasoning_summary": {
        "type": "string",
        "maxLength": 500,
        "description": "A 1-2 sentence summary of why you're taking this action. This appears in the trade log."
      }
    }
  }
}
```

### 8.2 Example Responses

**Open Long:**
```json
{
  "action": "open_long",
  "symbol": "BTCUSDT",
  "position_size_usdt": 1500,
  "stop_loss_price": 61200.00,
  "take_profit_price": 67500.00,
  "confidence": 78,
  "reasoning_summary": "BTC showing strong momentum confluence: RSI 62, MACD histogram increasing, price above all EMAs. ADX at 32 confirms trend strength. Entering with 15% of portfolio, 2x ATR stop."
}
```

**Close Position:**
```json
{
  "action": "close_position",
  "symbol": "ETHUSDT",
  "position_id": 42,
  "confidence": 85,
  "reasoning_summary": "ETH reached take-profit zone near prior swing high. RSI at 73 showing overbought. MACD histogram declining for 2 candles. Taking profit before momentum fades."
}
```

**Hold:**
```json
{
  "action": "hold",
  "confidence": 70,
  "reasoning_summary": "No clear setups. Market is ranging with ADX below 20 on most pairs. Current open positions are within normal parameters. Waiting for a clearer signal."
}
```

### 8.3 Validation Rules (enforced by orchestrator, not Claude)

```python
def validate_action(action: AgentAction, agent: Agent, portfolio: Portfolio) -> ValidationResult:
    """Validate an agent's action before execution. Returns errors if invalid."""
    errors = []

    if action.action in ("open_long", "open_short"):
        # Position size check
        max_size = portfolio.total_equity * PortfolioManager.MAX_POSITION_PCT
        if action.position_size_usdt > max_size:
            errors.append(f"Position size {action.position_size_usdt} exceeds max {max_size:.2f}")

        # Concurrent position check
        open_count = count_open_positions(agent.id)
        if open_count >= PortfolioManager.MAX_CONCURRENT_POSITIONS:
            errors.append(f"Already at max {PortfolioManager.MAX_CONCURRENT_POSITIONS} positions")

        # Cash check
        if action.position_size_usdt > portfolio.cash_balance:
            errors.append(f"Insufficient cash: {portfolio.cash_balance:.2f}")

        # Stop-loss direction check
        if action.stop_loss_price:
            if action.action == "open_long" and action.stop_loss_price >= current_price:
                errors.append("Long stop-loss must be below current price")
            if action.action == "open_short" and action.stop_loss_price <= current_price:
                errors.append("Short stop-loss must be above current price")

    if action.action in ("close_position", "adjust_stop_loss", "adjust_take_profit"):
        if not action.position_id:
            errors.append("position_id required")
        elif not position_belongs_to_agent(action.position_id, agent.id):
            errors.append("Position does not belong to this agent")

    return ValidationResult(valid=len(errors) == 0, errors=errors)
```

---

## 9. Next.js Frontend

### 9.1 Route Structure

```
/                           Rankings page (default: 1H timeframe)
/agents                     Agent leaderboard
/agents/[agentId]           Agent detail page (tabs: overview, trades, reasoning, prompt, config)
/api/agents/[agentId]/prompt  POST: save prompt edit
```

### 9.2 Data Fetching Strategy

| Page | Fetch Method | Revalidation | Rationale |
|------|-------------|-------------|-----------|
| `/` (Rankings) | Server Component + ISR | Per-timeframe (60s to 3600s) | Data changes on schedule. ISR matches computation cadence. |
| `/agents` (Leaderboard) | Server Component + ISR | 60 seconds | Agent metrics change with every decision cycle. 60s is fresh enough. |
| `/agents/[agentId]` | Server Component + ISR | 30 seconds | Detail page should be current when viewing an active agent. |
| `/api/agents/[id]/prompt` | Route Handler (POST) | N/A | Write endpoint. No caching. |

### 9.3 Rankings Page Data Flow

```tsx
// app/page.tsx -- Server Component
// Fetches ALL 6 timeframes in parallel on the server, passes to client component

import { getAllTimeframeRankings } from "@/lib/queries/rankings";

export const revalidate = 60; // Shortest TF revalidation

export default async function RankingsPage() {
  const rankings = await getAllTimeframeRankings();
  // rankings: Record<Timeframe, RankingSnapshot[]>

  return <RankingsTable allTimeframes={rankings} />;
}
```

```tsx
// components/rankings/rankings-table.tsx -- Client Component
"use client";

// All 6 timeframes already loaded. Switching is purely client-side state.
// No network request on timeframe change.

export function RankingsTable({ allTimeframes }: Props) {
  const [timeframe, setTimeframe] = useTimeframe("1h");
  const data = allTimeframes[timeframe];

  return (
    <>
      <TimeframeSelector value={timeframe} onChange={setTimeframe} />
      <DataTable data={data} />
    </>
  );
}
```

### 9.4 Rankings Query

```typescript
// lib/queries/rankings.ts

export async function getAllTimeframeRankings(): Promise<Record<string, Snapshot[]>> {
  const timeframes = ["15m", "30m", "1h", "4h", "1d", "1w"];

  // For each timeframe, get the latest complete run and all its snapshots
  const results = await Promise.all(
    timeframes.map(async (tf) => {
      const rows = await sql`
        SELECT s.*, sym.symbol, sym.base_asset,
               cr.finished_at as last_updated
        FROM snapshots s
        JOIN symbols sym ON s.symbol_id = sym.id
        JOIN computation_runs cr ON s.run_id = cr.id
        WHERE s.timeframe = ${tf}
          AND s.run_id = (
            SELECT id FROM computation_runs
            WHERE timeframe = ${tf} AND status = 'completed'
            ORDER BY finished_at DESC LIMIT 1
          )
        ORDER BY s.rank ASC
      `;
      return [tf, rows] as const;
    })
  );

  return Object.fromEntries(results);
}
```

### 9.5 Agent Leaderboard Query

```typescript
// lib/queries/agents.ts

export async function getAgentLeaderboard(): Promise<AgentLeaderboardRow[]> {
  return sql`
    SELECT
      a.id,
      a.name,
      a.display_name,
      a.strategy_archetype,
      a.timeframe,
      a.scan_model,
      a.trade_model,
      a.evolution_model,
      a.status,
      p.cash_balance,
      p.total_equity,
      p.total_realized_pnl,
      p.total_fees_paid,
      (p.total_equity - a.initial_balance) as total_pnl,
      (SELECT COUNT(*) FROM agent_trades WHERE agent_id = a.id) as trade_count,
      (SELECT COUNT(*) FILTER (WHERE pnl > 0) FROM agent_trades WHERE agent_id = a.id) as wins,
      (SELECT MIN(total_equity) FROM agent_portfolios WHERE agent_id = a.id) as max_drawdown_equity,
      (
        SELECT COALESCE(SUM(estimated_cost_usd), 0)
        FROM agent_token_usage WHERE agent_id = a.id
      ) as total_token_cost,
      (SELECT COUNT(*) FROM agent_positions WHERE agent_id = a.id) as open_positions
    FROM agents a
    JOIN agent_portfolios p ON a.id = p.agent_id
    ORDER BY (p.total_equity - a.initial_balance) DESC
  `;
}
```

### 9.6 Prompt Edit API Route

```typescript
// app/api/agents/[agentId]/prompt/route.ts

import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const { system_prompt } = await request.json();

  if (!system_prompt || typeof system_prompt !== "string") {
    return NextResponse.json({ error: "system_prompt is required" }, { status: 400 });
  }

  // Get current active prompt for diff
  const [current] = await sql`
    SELECT version, system_prompt FROM agent_prompts
    WHERE agent_id = ${agentId} AND is_active = true
  `;

  if (!current) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const newVersion = current.version + 1;

  // Get current performance snapshot
  const [perf] = await sql`
    SELECT
      p.total_realized_pnl as pnl,
      (SELECT COUNT(*) FILTER (WHERE pnl > 0)::float /
       NULLIF(COUNT(*), 0) FROM agent_trades WHERE agent_id = ${agentId}) as win_rate,
      (SELECT COUNT(*) FROM agent_trades WHERE agent_id = ${agentId}) as trades
    FROM agent_portfolios p WHERE p.agent_id = ${agentId}
  `;

  // Deactivate current, insert new
  await sql.begin(async (tx) => {
    await tx`UPDATE agent_prompts SET is_active = false WHERE agent_id = ${agentId} AND is_active = true`;

    await tx`
      INSERT INTO agent_prompts (agent_id, version, system_prompt, source, diff_from_previous, performance_at_change, is_active)
      VALUES (${agentId}, ${newVersion}, ${system_prompt}, 'human', ${generateDiff(current.system_prompt, system_prompt)}, ${JSON.stringify(perf)}, true)
    `;
  });

  return NextResponse.json({ version: newVersion });
}
```

### 9.7 Component Architecture

```
RankingsPage (Server Component)
└── RankingsTable (Client)
    ├── TimeframeSelector
    ├── SearchInput
    ├── DataTable (shadcn)
    │   └── RankingRow (per symbol)
    │       ├── ScoreBar
    │       ├── ConfidenceBadge
    │       ├── HighlightChip[] (mapped from highlights array)
    │       └── IndicatorBreakdown (expandable)
    └── LastUpdatedBadge

AgentLeaderboardPage (Server Component)
└── AgentLeaderboard (Client)
    ├── TimeframeFilter
    ├── ArchetypeFilter
    ├── DataTable (shadcn)
    │   └── AgentRow (per agent)
    │       ├── StrategyBadge
    │       ├── PnlDisplay (colored)
    │       ├── WinRateBadge
    │       ├── ModelBadges (scan/trade/evolution)
    │       ├── TokenCostDisplay
    │       └── PauseResumeToggle
    └── SortControls

AgentDetailPage (Server Component)
└── AgentDetail (Client)
    ├── AgentHeader (name, archetype, timeframe, status)
    └── Tabs (shadcn)
        ├── OverviewTab
        │   ├── EquityChart (simple line chart)
        │   ├── MetricsGrid (PnL, win rate, trades, drawdown, cost)
        │   └── OpenPositionsTable
        ├── TradeHistoryTab
        │   └── TradeTable
        │       └── TradeRow (expandable → full reasoning)
        ├── ReasoningLogTab
        │   └── DecisionList (searchable, filterable by action)
        │       └── DecisionCard (summary + expandable full response)
        ├── PromptTab
        │   ├── PromptEditor (textarea + save button)
        │   └── PromptHistory (timeline of versions with diff view)
        └── ModelConfigTab
            ├── ModelSelector (scan_model dropdown)
            ├── ModelSelector (trade_model dropdown)
            ├── ModelSelector (evolution_model dropdown)
            └── TokenUsageBreakdown (table by model × task_type)
```

---

## 10. Deployment & Infrastructure

### 10.1 Python Worker (Fly.io)

```dockerfile
# worker/Dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY src/ src/
COPY alembic/ alembic/
COPY alembic.ini .

# Run migrations then start worker
CMD ["sh", "-c", "alembic upgrade head && python -m src.main"]
```

```toml
# fly.toml
app = "alpha-worker"
primary_region = "iad"  # US East (close to Neon/Supabase)

[build]
  dockerfile = "worker/Dockerfile"

[env]
  PYTHON_ENV = "production"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"

[http_service]
  internal_port = 8000
  auto_stop_machines = false    # Must stay running for cron
  auto_start_machines = true
  min_machines_running = 1

[checks]
  [checks.health]
    type = "http"
    port = 8000
    path = "/health"
    interval = "30s"
    timeout = "5s"
```

### 10.2 Next.js Frontend (Vercel)

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,  // Partial Prerendering
  },
};

export default nextConfig;
```

```json
// vercel.json
{
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

### 10.3 Database (Neon -- recommended)

Neon is the recommended PostgreSQL provider for this stack:
- Built-in connection pooler (no external PgBouncer needed)
- Serverless driver compatible with Vercel Edge
- Generous free tier (0.5 GB storage, 190 compute hours)
- Auto-scaling for compute
- Branching for development/staging

---

## 11. Environment Variables

### Worker (`alpha-worker`)

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/alpha_board

# Binance
BINANCE_BASE_URL=https://api.binance.com

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Worker config
WORKER_PORT=8000
LOG_LEVEL=INFO

# Feature flags
AGENTS_ENABLED=true
EVOLUTION_ENABLED=true
```

### Frontend (`alpha-web`)

```env
# Database (read-only connection via Neon pooler)
DATABASE_URL=postgresql://user:pass@host:5432/alpha_board?sslmode=require

# Neon serverless driver (for Edge Runtime compatibility)
DATABASE_URL_UNPOOLED=postgresql://user:pass@host:5432/alpha_board?sslmode=require
```

No Anthropic API key on the frontend. The frontend never calls Claude directly.

---

## 12. Error Handling & Recovery

### 12.1 Rankings Pipeline Errors

| Error | Handling |
|-------|----------|
| Binance API timeout | Retry 3x with exponential backoff (1s, 2s, 4s). If all fail, skip symbol and continue. Log warning. |
| Binance rate limit (429) | Wait for `Retry-After` header value. If no header, wait 60s. |
| Indicator computation error (NaN, insufficient data) | Skip that indicator for that symbol. Reduce confidence score. Log warning. |
| Database write failure | Retry once. If still fails, mark computation_run as failed. Advisory lock is released. Next cycle retries. |
| Full pipeline timeout (>5 min for one timeframe) | Kill the run. Mark as failed. Release lock. Log error. |

### 12.2 Agent Decision Errors

| Error | Handling |
|-------|----------|
| Claude API timeout (>30s) | Retry once with the same context. If still fails, log as `hold` with error in reasoning. |
| Claude API rate limit | Wait and retry. Agents run sequentially so this rarely triggers. |
| Unparseable Claude response (no tool_use) | Log the raw response. Record as `hold` with validation error. Alert for investigation. |
| Invalid action (validation fails) | Log as `hold` with validation errors in reasoning. Do not execute the action. |
| Portfolio constraint violation | Same as invalid action. Log and hold. |
| Database error during position update | Retry once. If fails, log error but do not retry the Claude API call (idempotency risk). |

### 12.3 Prompt Evolution Errors

| Error | Handling |
|-------|----------|
| Claude API failure during evolution | Skip evolution for this cycle. Retry at next threshold crossing. |
| Generated prompt is empty or too short (<100 chars) | Reject. Keep current prompt. Log warning. |
| Performance drops >20% after auto-evolution | Auto-revert to previous prompt. Set `is_active = true` on previous version. Log revert event. |

### 12.4 SL/TP Execution

Stop-loss and take-profit checks use candle high/low, not just close:

```python
def check_sl_tp(position: Position, candle: Candle) -> str | None:
    """Check if SL or TP was hit during this candle.
    Returns 'stop_loss', 'take_profit', or None."""

    if position.direction == "long":
        if position.stop_loss and candle.low <= position.stop_loss:
            return "stop_loss"   # Exit at stop_loss price
        if position.take_profit and candle.high >= position.take_profit:
            return "take_profit" # Exit at take_profit price

    elif position.direction == "short":
        if position.stop_loss and candle.high >= position.stop_loss:
            return "stop_loss"
        if position.take_profit and candle.low <= position.take_profit:
            return "take_profit"

    return None
```

If both SL and TP are hit in the same candle (extreme volatility), **stop-loss takes priority** (conservative assumption: the adverse move happened first).

---

## 13. Monitoring & Observability

### 13.1 Health Check Endpoint

```
GET /health

Response:
{
  "status": "ok",
  "uptime_seconds": 3600,
  "last_runs": {
    "15m": {"status": "completed", "finished_at": "2026-02-04T12:05:32Z", "duration_ms": 45200},
    "1h":  {"status": "completed", "finished_at": "2026-02-04T12:00:15Z", "duration_ms": 52100},
    ...
  },
  "active_agents": 28,
  "paused_agents": 0,
  "open_positions": 12,
  "db_connection": "ok"
}
```

### 13.2 Key Metrics to Track

| Metric | Source | Alert threshold |
|--------|--------|----------------|
| Pipeline run duration per timeframe | `computation_runs` table | > 120s for 15m timeframe |
| Pipeline failure rate | `computation_runs` with status='failed' | > 2 consecutive failures |
| Agent decision cycle duration | Application logs | > 5 minutes total for 4 agents |
| Claude API error rate | Application logs | > 5% of calls failing |
| Token cost per day (total) | `agent_token_usage` aggregation | Configurable per-day budget |
| Token cost per agent per day | `agent_token_usage` per agent | Configurable per-agent budget |
| Database row count per partition | PostgreSQL system tables | > 10M rows per month-partition |
| Open position count per agent | `agent_positions` | > MAX_CONCURRENT_POSITIONS (should never happen) |
| Prompt evolution frequency | `agent_prompts` table | > 3 evolutions per agent per day (possible thrashing) |
| Strategy drift between agents | Prompt similarity analysis | > 80% similarity between any two agents |

### 13.3 Logging

Structured JSON logging to stdout (captured by Fly.io logging):

```python
import structlog

logger = structlog.get_logger()

# Pipeline events
logger.info("pipeline.run.started", timeframe="1h", symbol_count=200)
logger.info("pipeline.run.completed", timeframe="1h", duration_ms=45200)
logger.error("pipeline.run.failed", timeframe="1h", error="Binance API timeout")

# Agent events
logger.info("agent.decision", agent="momentum-1h", action="open_long", symbol="BTCUSDT", confidence=78)
logger.info("agent.evolution", agent="momentum-1h", from_version=3, to_version=4, source="auto")
logger.warning("agent.evolution.reverted", agent="momentum-1h", reason="pnl_drop_exceeded_threshold")
logger.info("agent.sl_triggered", agent="breakout-4h", symbol="ETHUSDT", pnl=-45.20)
```

### 13.4 Retention Cleanup Job

Runs daily at 03:00 UTC:

```python
async def cleanup_old_data():
    """Drop snapshot partitions older than 90 days.
    Agent data is retained indefinitely in v1."""

    cutoff = datetime.now(timezone.utc) - timedelta(days=90)

    # Drop old snapshot partitions
    # (partitions are named by month, so drop partitions 4+ months old)
    old_partitions = await get_partitions_before(cutoff)
    for partition in old_partitions:
        await sql(f"DROP TABLE IF EXISTS {partition}")

    # Create next month's partition if it doesn't exist
    await create_next_month_partition("snapshots")
    await create_next_month_partition("agent_decisions")
```
