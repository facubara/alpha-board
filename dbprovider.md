# Database Provider Evaluation Report

A comprehensive evaluation of database providers (Postgres-compatible and otherwise) to inform whether Alpha Board should stay on Neon or migrate — and if so, where.

**Why:** The project runs on **Neon Postgres (free tier)** shared between the worker (Fly.io, Amsterdam) and the web app (Vercel, US-East). As the system scales from 28 to 104 agents (feature #9) and data accumulates, the 0.5 GiB free-tier ceiling and cross-region latency will become constraints. This report documents the tradeoffs so the decision is informed, not reactive.

---

## A. Current State Baseline

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

## B. Provider-by-Provider Evaluation

### Tier 1 — Postgres-Compatible (Drop-in Migration)

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

### Tier 3 — Non-Postgres (Major Rewrite Required)

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

## C. Comparison Matrix

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

## D. Migration Complexity Assessment

### Tier 1 — Connection String Swap + Web Driver Change (1–2 hours)

**Applies to:** Supabase, Railway, Render, Aiven, AWS RDS, Tembo

Steps:
1. **Worker:** Change `DATABASE_URL` environment variable in Fly.io secrets. SQLAlchemy + psycopg3 async works with any standard Postgres — zero code changes in `worker/src/db.py`.
2. **Web:** Replace `@neondatabase/serverless` with `postgres` (postgres.js) in `web/src/lib/db.ts`. This is the **only Neon-specific dependency** in the codebase.
3. **Queries:** The 4 query files (`rankings.ts`, `agents.ts`, `analytics.ts`, `backtest.ts`) use standard SQL tagged templates (`sql\`...\``) — no changes needed regardless of driver.
4. **Data migration:** `pg_dump` from Neon → `pg_restore` to new provider. Partitioned tables may need `--no-owner --no-privileges` flags.

### Tier 2 — Tier 1 + Ongoing Ops Burden

**Applies to:** Fly.io Postgres

Same code changes as Tier 1, plus:
- Set up automated backups (cron → `pg_dump` → S3/volume)
- Configure monitoring (pg_stat_statements, disk alerts)
- Handle Postgres version upgrades manually
- No automatic failover — single point of failure unless you set up Stolon/Patroni

### Tier 3 — Schema and Code Rewrite (Days to Weeks)

**Applies to:** CockroachDB (~2–3 days), Turso/PlanetScale (not viable)

CockroachDB specifics:
- Remove all `RANGE` partitioning DDL from migrations (CockroachDB uses hash-sharding)
- Replace `pg_advisory_xact_lock` with CockroachDB's `SELECT FOR UPDATE` or application-level distributed locks
- Test all JSONB operations (mostly compatible but edge cases exist)

Turso/PlanetScale:
- Full ORM rewrite, different query syntax, loss of too many features — not practical for this project.

---

## E. Cost Projection

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

## F. Region & Latency Analysis

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

## G. Recommendation (Ranked Shortlist)

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

## Key Files Referenced

| File | Relevance |
|------|-----------|
| `worker/src/db.py` | Async engine config — `pool_size=5`, `max_overflow=10` via psycopg3 |
| `web/src/lib/db.ts` | Neon serverless driver — the **only** Neon-specific code dependency |
| `worker/src/models/db.py` | 16 ORM models using all 8 Postgres features |
| `worker/src/pipeline/runner.py` | Advisory locks + ON CONFLICT upserts |
| `worker/fly.toml` | Worker region: `ams` |
| `web/vercel.json` | Web region: `iad1` |
| `web/src/lib/queries/` | 4 query files using standard SQL tagged templates |
