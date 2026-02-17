# Alpha Board — Progress Tracker

**Last Updated:** 2026-02-17
**Current Phase:** Complete (all 15 phases done) + Post-launch features

---

## Implementation Progress

| Phase | Name | Status | Commit | Date |
|-------|------|--------|--------|------|
| 1 | Scaffolding | Done | `59e2113` | 2026-02-04 |
| 2 | DB Schema | Done | `86764c4` | 2026-02-05 |
| 3 | Binance Client | Done | `8b953b5` | 2026-02-05 |
| 4 | Indicators | Done | `3f8c317` | 2026-02-05 |
| 5 | Scoring | Done | `03caeb6` | 2026-02-05 |
| 6 | Pipeline | Done | `26679ef` | 2026-02-05 |
| 7 | Rankings UI Core | Done | `f8d285b` | 2026-02-05 |
| 8 | Rankings UI Polish | Done | `86aa811` | 2026-02-05 |
| 9 | Agent Core | Done | `55f827c` | 2026-02-05 |
| 10 | Agent Learning | Done | `0557b62` | 2026-02-05 |
| 11 | Agent Leaderboard | Done | — | 2026-02-09 |
| 12 | Agent Detail | Done | — | 2026-02-09 |
| 13 | Deployment | Done | — | 2026-02-09 |
| 14 | Testing & Polish | Done | — | 2026-02-09 |
| 15 | Rule-Based Agents | Done | — | 2026-02-11 |

**Progress: 15/15 phases complete (100%)**

---

## Stage Progress

| Stage | Phases | Status |
|-------|--------|--------|
| A: Foundation | 1-6 | 6/6 complete |
| B: Rankings Frontend | 7-8 | 2/2 complete |
| C: Agent Backend | 9-10 | 2/2 complete |
| D: Agent Frontend | 11-12 | 2/2 complete |
| E: Deployment | 13-14 | 2/2 complete |

---

## Milestones

- [x] **Runnable dev environment** — Phase 1
- [x] **Database ready with seed data** — Phase 2
- [x] **Can fetch live market data** — Phase 3
- [x] **Can compute all 9 indicators** — Phase 4
- [x] **Can score and rank symbols** — Phase 5
- [x] **Rankings backend live** — Phase 6
- [x] **Rankings frontend MVP** — Phase 7
- [x] **Rankings frontend complete** — Phase 8
- [x] **Agents making decisions** — Phase 9
- [x] **Agents evolving autonomously** — Phase 10
- [x] **Agent frontend MVP** — Phase 11
- [x] **Agent frontend complete** — Phase 12
- [x] **Deployment configs ready** — Phase 13
- [x] **Production-ready** — Phase 14
- [x] **Rule-based agents coexist with LLM agents** — Phase 15
- [x] **Real-Time Updates (SSE)** — Post-launch feature
- [x] **Cross-Timeframe Agents** — Post-launch feature
- [x] **Backtesting Framework** — Post-launch feature
- [x] **Performance Dashboard / Analytics** — Post-launch feature
- [x] **Advanced Charting (TradingView)** — Post-launch feature
- [x] **Agent Comparison Mode** — Post-launch feature
- [x] **Symbol-Agent Cross-Referencing** — Post-launch feature
- [x] **Candle Close Countdown** — Post-launch feature
- [x] **Redis Caching Layer (Upstash)** — Post-launch feature
- [x] **Twitter Feed & Tweet Agents** — Post-launch feature
- [x] **Consensus Ticker Banner** — Post-launch feature
- [x] **Notification System** — Post-launch feature
- [x] **Rankings Table Columns** — Post-launch feature

---

## Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| Exchange | 10 | Pass |
| Indicators | 47 | Pass |
| Scoring | 23 | Pass |
| Pipeline | 17 | Pass |
| Agents | 27 | Pass |
| Evolution | 21 | Pass |
| **Total** | **145** | **Pass** |

---

## Key Decisions Made

| Phase | Decision | Choice |
|-------|----------|--------|
| 1 | Package manager | `uv` |
| 3 | Rate limiting | Semaphore (10 concurrent) + 50ms delay |
| 4 | Indicator library | pandas-ta |
| 4 | Signal range | [-1, +1] normalized |
| 5 | Confidence components | Agreement 60%, Completeness 25%, Volume 15% |
| 6 | Scheduler interval | 5 minutes (check all timeframes) |
| 6 | Advisory lock | Per-timeframe (allows parallel TF runs) |
| 7 | Color mode | Dark-only (e-ink aesthetic) |
| 7 | Design system | E-ink inspired (monochrome, compact) |
| 7 | Component library | shadcn/ui |
| 8 | ISR revalidation | 60 seconds |
| 8 | Sort default | Rank ascending |
| 9 | Max position size | 25% of equity |
| 9 | Max concurrent positions | 5 per agent |
| 9 | Trading fee | 0.1% per trade |
| 9 | Multiple positions per symbol | No (1 per symbol per agent) |
| 10 | Memory model | scan_model (Haiku) for cost efficiency |
| 10 | Auto-revert threshold | 20% PnL drop after evolution |
| 10 | Evolution trigger | Per-agent configurable (default 10 trades) |
| 12 | Chart library | Pure SVG (no external dependency) |
| 13 | Worker deployment | Fly.io (shared-cpu-1x, 512MB) |
| 13 | Frontend deployment | Vercel (iad1 region) |
| 13 | Partition retention | 90 days, daily cleanup at 03:00 UTC |
| 15 | Engine distinction | `engine` column on agents table (llm/rule) |
| 15 | Strategy pattern | ABC base class with per-archetype registry |
| 15 | Rule agent naming | `rb-{archetype}-{tf}` prefix convention |
| 15 | Skip memory/evolution | Guard in orchestrator for rule agents |

---

## Post-Launch Features (from next-steps.md)

| # | Feature | Status |
|---|---------|--------|
| 1 | Real-Time Updates (SSE) | Done |
| 2 | Cross-Timeframe Agents | Done |
| 3 | Backtesting Framework | Done |
| 4 | Performance Dashboard / Analytics | Done |
| 5 | Advanced Charting (TradingView) | Done |
| 6 | Agent Comparison Mode | Done |
| 7 | Caching Layer (Redis) | Done |
| 8 | Symbol-Agent Cross-Referencing | Done |
| 9 | Twitter Feed & Tweet Agents | Done |
| 10 | Consensus Ticker Banner | Done |
| 11 | Notification System | Done |
| 12 | Rankings Table Columns | Done |

## Open Decisions

None — all decisions resolved.

---

## Recent Sessions

| Date | Session | Goal |
|------|---------|------|
| 2026-02-17 00:30 | Post-launch | Consensus Ticker Banner (#10) |
| 2026-02-16 09:25 | Post-launch | Twitter Feed & Tweet Agents (#9) |
| 2026-02-15 23:00 | Post-launch | Redis Caching Layer (#7) — Upstash |
| 2026-02-13 00:20 | Post-launch | Symbol cross-ref (#8) + candle countdown |
| 2026-02-12 20:00 | Post-launch | Agent Comparison Mode (#6) |

---

## Deployment Checklist

### Neon Database
- [ ] Create production database on Neon
- [ ] Run `alembic upgrade head`
- [ ] Verify connection pooling (built-in with Neon)
- [ ] Set up dev branch for development

### Python Worker (Fly.io)
- [ ] `fly launch` with `worker/fly.toml`
- [ ] Set secrets: `fly secrets set DATABASE_URL=... ANTHROPIC_API_KEY=...`
- [ ] Verify `/health` endpoint responds
- [ ] Verify scheduled pipeline runs in logs

### Next.js Frontend (Vercel)
- [ ] Connect Git repo to Vercel
- [ ] Set `web/` as root directory
- [ ] Set `DATABASE_URL` environment variable
- [ ] Verify ISR revalidation works
- [ ] Custom domain (optional)

---

*See `docs/IMPLEMENTATION_PLAN.md` for full phase details.*
