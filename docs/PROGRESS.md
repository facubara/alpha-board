# Alpha Board — Progress Tracker

**Last Updated:** 2026-02-05 20:30
**Current Phase:** Phase 11 (Agent Leaderboard)

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
| 11 | Agent Leaderboard | Pending | — | — |
| 12 | Agent Detail | Pending | — | — |
| 13 | Deployment | Pending | — | — |
| 14 | Testing & Polish | Pending | — | — |

**Progress: 10/14 phases complete (71%)**

---

## Stage Progress

| Stage | Phases | Status |
|-------|--------|--------|
| A: Foundation | 1-6 | 6/6 complete |
| B: Rankings Frontend | 7-8 | 2/2 complete |
| C: Agent Backend | 9-10 | 2/2 complete |
| D: Agent Frontend | 11-12 | 0/2 complete |
| E: Deployment | 13-14 | 0/2 complete |

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
- [ ] **Agent frontend MVP** — Phase 11
- [ ] **Agent frontend complete** — Phase 12
- [ ] **Live in production** — Phase 13
- [ ] **Production-ready** — Phase 14

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

---

## Open Decisions

| Decision | Options | Resolve In |
|----------|---------|------------|
| Chart library | Recharts, Chart.js, SVG | Phase 12 |

---

## Recent Sessions

| Date | Session | Goal |
|------|---------|------|
| 2026-02-05 20:00 | Phase 10 | Agent Learning & Evolution |
| 2026-02-05 19:00 | Phase 9 | Agent Core |
| 2026-02-05 18:30 | Phase 8 | Rankings UI Polish |
| 2026-02-05 17:30 | Phase 7 | Rankings UI Core |
| 2026-02-05 17:00 | Phase 6 | Pipeline Orchestration |
| 2026-02-05 16:15 | Phase 5 | Scoring & Ranking |
| 2026-02-05 15:30 | Phase 4 | Indicator Engine |
| 2026-02-05 14:30 | Phase 3 | Binance Client |
| 2026-02-05 13:00 | Verify | Phase 1-2 verification |
| 2026-02-05 12:00 | Phase 2 | DB Schema & Migrations |

---

*See `docs/IMPLEMENTATION_PLAN.md` for full phase details.*
