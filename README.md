# Alpha Board

Crypto market analytics platform that ranks the top 200 Binance USDT pairs by bullish strength across 6 timeframes — and lets 28 autonomous AI trading agents compete using those rankings.

## What It Does

**Rankings Engine** — Fetches OHLCV data from Binance, computes technical indicators (RSI, MACD, Stochastic, ADX, OBV, Bollinger Bands, EMAs), and produces a 0–1 bullish score with confidence for every symbol on a scheduled cadence.

**AI Agent Arena** — 28 agents with distinct strategy archetypes (momentum, mean reversion, breakout, swing, and 4 cross-timeframe variants) make simulated trades powered by Claude. Each agent has its own portfolio, memory bank, and auto-evolving prompt.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Alpha Board                                 │
├──────────────────────┬──────────────────────┬────────────────────────┤
│                      │                      │                        │
│   Next.js Web App    │   FastAPI Worker      │   Neon Postgres        │
│   (Vercel)           │   (Fly.io)            │   (Shared DB)          │
│                      │                      │                        │
│  • Rankings table    │  • Binance pipeline   │  • Symbols & snapshots │
│  • Agent leaderboard │  • Indicator engine   │  • Agent portfolios    │
│  • Equity curves     │  • Agent orchestrator │  • Trade history       │
│  • Analytics dash    │  • Claude executor    │  • Decision logs       │
│  • Backtest UI       │  • Prompt evolution   │  • Backtest results    │
│  • Candlestick charts│  • SSE streaming      │  • Token usage         │
│  • Symbol detail     │  • APScheduler        │  • Monthly partitions  │
│                      │                      │                        │
└──────────────────────┴──────────────────────┴────────────────────────┘
```

## Tech Stack

### Web (`web/`)
- **Next.js 16** with App Router, React 19, TypeScript 5.9
- **Tailwind CSS 4** — custom e-ink design system (monochrome, data-dense)
- **Lightweight Charts** — candlestick + indicator overlays
- **Neon serverless driver** — direct Postgres queries from server components
- **ISR** — 60s revalidation + SSE for real-time updates

### Worker (`worker/`)
- **Python 3.12**, FastAPI, uvicorn
- **pandas + pandas-ta** — technical indicator computation
- **Anthropic Claude API** — agent decision-making (Haiku for scanning, Sonnet for trading, Opus for evolution)
- **SQLAlchemy 2.0** (async) + Alembic migrations
- **APScheduler** — cron-driven pipeline per timeframe
- **httpx** — async Binance REST client

### Database
- **Neon Postgres** — shared by web and worker
- Monthly-partitioned snapshots, 90-day retention
- 10 Alembic migrations

## Features

| Feature | Description |
|---------|-------------|
| **Bullish Rankings** | Top 200 symbols scored 0–1 across 6 timeframes (15m, 30m, 1h, 4h, 1d, 1w) |
| **28 AI Agents** | Autonomous Claude-powered traders with portfolio management |
| **Strategy Archetypes** | Momentum, mean reversion, breakout, swing + cross-timeframe confluence/divergence/cascade/regime |
| **Dual Engines** | Each archetype runs as both `llm` (Claude) and `rule` (deterministic Python) |
| **Real-Time SSE** | Live ranking and agent updates streamed to the dashboard |
| **Agent Comparison** | Side-by-side equity curves + reasoning diffs for 2–4 agents |
| **Backtesting** | Bar-by-bar historical replay with equity curves and Sharpe ratios |
| **Analytics Dashboard** | Fleet-wide PnL, win rates, drawdown, token costs by archetype/timeframe |
| **Candlestick Charts** | Interactive charts with RSI, MACD, EMA, Bollinger Band overlays |
| **Symbol Cross-Ref** | See which agents are trading a symbol; filter agents by symbol |
| **Prompt Evolution** | Agents auto-tune their prompts based on performance |
| **Memory Bank** | Agents accumulate and reference past decisions |
| **Telegram Alerts** | Notifications for significant trades and daily digests |

## Project Structure

```
alpha-board/
├── worker/                     # Python FastAPI backend (Fly.io)
│   ├── src/
│   │   ├── main.py             # FastAPI app + APScheduler
│   │   ├── pipeline/           # Rankings pipeline orchestration
│   │   ├── exchange/           # Binance REST client
│   │   ├── indicators/         # RSI, MACD, EMA, Bollinger, etc.
│   │   ├── scoring/            # Bullish score + confidence
│   │   ├── agents/             # Orchestrator, executor, strategies
│   │   │   ├── orchestrator.py # Main agent decision cycle
│   │   │   ├── executor.py     # Claude API integration
│   │   │   ├── portfolio.py    # Position & trade management
│   │   │   ├── evolution.py    # Auto prompt evolution
│   │   │   ├── memory.py       # Agent memory bank
│   │   │   └── strategies/     # 8 rule-based implementations
│   │   ├── backtest/           # Historical replay engine
│   │   ├── models/             # SQLAlchemy ORM models
│   │   └── notifications/      # Telegram alerts
│   ├── alembic/                # Database migrations
│   ├── Dockerfile
│   └── fly.toml
│
├── web/                        # Next.js frontend (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Rankings (default page)
│   │   │   ├── agents/         # Leaderboard + agent detail
│   │   │   ├── analytics/      # Fleet performance dashboard
│   │   │   ├── backtest/       # Backtest runner + results
│   │   │   └── symbols/        # Symbol detail + charts
│   │   ├── components/         # UI components by domain
│   │   └── lib/                # DB queries, types, utils
│   ├── package.json
│   └── next.config.ts
│
└── docs/                       # Design system, specs, session notes
```

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.12+
- A Neon Postgres database
- Anthropic API key (for AI agents)
- Binance API access (public endpoints, no key required)

### Web

```bash
cd web
npm install
cp .env.example .env.local   # add DATABASE_URL, AUTH_SECRET, etc.
npm run dev                   # http://localhost:3000
```

### Worker

```bash
cd worker
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # add DATABASE_URL, ANTHROPIC_API_KEY, etc.
alembic upgrade head          # run migrations
uvicorn src.main:app --reload # http://localhost:8000
```

## Deployment

| Component | Platform | Trigger |
|-----------|----------|---------|
| **Web** | Vercel | Auto-deploy on push to `master` |
| **Worker** | Fly.io | `cd worker && fly deploy` |
| **Database** | Neon Postgres | Migrations via `alembic upgrade head` |

## Design Philosophy

Alpha Board uses an **e-ink aesthetic** — a monochrome palette inspired by Kindle displays, where color is reserved exclusively for semantic signals (green = bullish, red = bearish). The interface prioritizes information density and calm readability over the visual noise typical of crypto dashboards. Every pixel serves data.

## Timeframes

| Code | Interval | Pipeline Cadence |
|------|----------|-----------------|
| `15m` | 15 minutes | Every 5 min |
| `30m` | 30 minutes | Every 10 min |
| `1h` | 1 hour | Every 15 min |
| `4h` | 4 hours | Every 30 min |
| `1d` | 1 day | Every 2 hours |
| `1w` | 1 week | Every 6 hours |

## License

Private project. All rights reserved.
