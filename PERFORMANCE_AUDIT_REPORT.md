# ALPHA BOARD PERFORMANCE AUDIT REPORT

**Date**: 2026-03-02
**Platform**: Alpha Board — 124 trading agents, real-time SSE, Next.js + FastAPI + Neon Postgres
**Auditors**: 5 specialized agents (Frontend, Query, Caching, Infrastructure, Data Architecture)

---

## EXECUTIVE SUMMARY

Five critical performance bottlenecks were identified. Together they cause **~700+ unnecessary database queries per minute**, block the async event loop for minutes at a time, and prevent Next.js from caching any API responses. Fixing these issues would reduce database load by **~95%**, cut page load times by **5-20x**, and enable concurrent agent processing.

### Top 5 Findings

| # | Finding | Impact | Effort |
|---|---------|--------|--------|
| 1 | **`revalidate: 0` in workerFetch defeats ALL Next.js caching** — Every API call bypasses the Data Cache. ~40 endpoints affected. | 80-90% reduction in worker API calls | 1 line change |
| 2 | **SSE broadcast executes ~58 queries every 5 seconds** — Two per-agent queries inside a loop for ~28 active agents = ~700 queries/minute | 97% reduction (58 -> 2 queries per cycle) | 30 min |
| 3 | **LEADERBOARD_SQL uses 4 correlated subqueries per agent row** — ~496 subquery executions per request across 124 agents | 99% reduction (496 -> 3 scans per request) | 20 min |
| 4 | **Sync Claude API calls block the event loop** — `anthropic.Anthropic` used in 3 critical paths; each call blocks 2-15 seconds | Unblocks event loop, enables 5x concurrent agent processing | 3 lines per file |
| 5 | **Zero worker-side response caching** — Every API request hits the database directly; no Redis response cache on any endpoint | 90% reduction in DB queries for cached endpoints | 1-2 days |

### Expected Aggregate Impact

| Metric | Before | After All Fixes |
|--------|--------|-----------------|
| SSE broadcast queries/min | ~700 | ~24 |
| Leaderboard queries/request | ~500 | ~5 |
| Worker API calls per page load | 6-12 | 0-1 (cache hits) |
| Agent cycle time (30 LLM agents) | 60-450s sequential | 12-90s concurrent |
| P95 API response time | 200-500ms | 5-10ms (cache hit) |

---

## SECTION 1: Frontend Performance

### Per-Page Audit

| Page | Route | Rendering Strategy | Data Fetching | Load Impact |
|------|-------|--------------------|---------------|-------------|
| Home | `/` | ISR 60s + Suspense streaming | `getAllTimeframeRankings()` via `workerGet` (no Redis cache) | **Medium** — ISR revalidate is set but `workerFetch` has `revalidate: 0` which overrides it, forcing every request to hit the worker API |
| Agents | `/agents` | ISR 60s | 3x parallel calls: `getAgentLeaderboard()`, `getDiscardedAgents()`, `getFleetLessons()` — first and last use Redis cache (60s/120s TTL) | **Medium** — Redis cache partially helps but `revalidate: 0` on fetch still bypasses Next.js Data Cache |
| Agent Detail | `/agents/[agentId]` | ISR 30s | 7x parallel calls per agent (detail, trades, decisions, prompts, positions, token usage, analysis history) — none use Redis cache | **High** — 7 uncached worker API calls per page view, multiplied across 124+ agents. Also calls `getAgentDetail` twice (once in `generateMetadata`, once in page body) |
| Agent Compare | `/agents/compare` | `force-dynamic` | 1x `getComparisonData()` (no Redis cache) | **Low-Medium** — force-dynamic is appropriate here (depends on `?ids=` searchParams) |
| Analytics | `/analytics` | `force-dynamic` | 12x parallel calls — ALL use Redis cache (120s TTL) | **High** — 12 API calls but Redis-cached. However, `force-dynamic` prevents any static generation. Should use ISR instead since Redis already controls freshness |
| Memecoins | `/memecoins` | ISR 60s + Suspense streaming | 7x parallel calls + 1 sequential `getBatchTokenSnapshots()` — none use Redis cache | **High** — 8 uncached API calls, waterfall pattern with sequential snapshot fetch |
| Tweets | `/tweets` | ISR 60s + Suspense streaming | 3x parallel calls (accounts, tweets, stats) — none use Redis cache | **Medium** — ISR is set but neutralized by `revalidate: 0` |
| Processing | `/processing` | ISR 30s | 2x parallel calls — none use Redis cache | **Low-Medium** — small payload, but still bypassed by `revalidate: 0` |
| Status | `/status` | `force-dynamic` | 2x parallel calls: `getStatusData()` (Redis-cached 60s), `getLlmSettings()` (no cache). Inside `getStatusData()`, 3 more parallel worker calls | **Medium** — force-dynamic is reasonable for health page, but inner calls produce 4 total worker API hits |
| Backtest | `/backtest` | `force-dynamic` | 1x `getBacktestRuns()` (no Redis cache) | **Low** — small payload |
| Settings | `/settings` | ISR 60s | 2x parallel calls — none use Redis cache | **Low** — admin page, low traffic |
| Symbol Detail | `/symbols/[symbol]` | `force-dynamic` | 1x `getSymbolAgentActivity()` (no Redis cache) | **Medium** — force-dynamic is appropriate (dynamic route), but no caching at any layer |
| Updates | `/updates` | Static (no data fetching) | Imports from local `changelog.ts` | **None** — fully static, no API calls |

### workerFetch Analysis

**Critical Issue: `revalidate: 0` on workerFetch defeats Next.js Data Cache**

File: `web/src/lib/worker-client.ts:26`:
```typescript
next: { revalidate: 0 },
```

This single line is the most impactful performance problem in the entire frontend:

1. **`revalidate: 0` means "never cache"** in the Next.js Data Cache. Every `fetch()` call made through `workerFetch` is treated as `cache: 'no-store'` equivalent.
2. **It overrides page-level ISR settings.** Even though pages like `/` set `export const revalidate = 60`, the underlying `fetch()` calls opt out of caching.
3. **Scale of impact:** Across all pages, there are approximately **40+ worker API calls** that flow through `workerFetch`. Every single one bypasses Next.js Data Cache.
4. **The fix is simple:** Remove `next: { revalidate: 0 }` from `workerFetch` and let each call site or page-level `revalidate` export control caching.

**Estimated impact:** Fixing this alone could reduce worker API load by 80-90% for repeat page views within the revalidation window.

### next.config.ts Gaps

File: `web/next.config.ts` (lines 1-8):
```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
};
```

Missing optimizations:
1. **No `experimental.ppr` (Partial Prerendering):** Pages already use Suspense boundaries, making them PPR-ready. Static shells serve instantly from edge; dynamic data streams in.
2. **No `experimental.optimizePackageImports`:** Heavy dependencies `recharts` (~45-60 KB), `lucide-react` (potentially 200+ KB without tree-shaking), `radix-ui` (~15-30 KB) could benefit significantly.
3. **No `poweredByHeader: false`:** Minor security hardening.

### vercel.json Gaps

File: `web/vercel.json`:

Missing:
1. **No security headers:** Missing `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`.
2. **No static asset cache headers:** No explicit `immutable` headers for `/_next/static/` assets.
3. **Single region (`iad1`):** Users in other regions experience higher TTFB.

### Bundle Analysis

| Package | Estimated Size (gzip) | Concern |
|---------|----------------------|---------|
| `recharts` v3.7.0 | ~45-60 KB | Full charting library, loaded even on non-chart pages unless code-split |
| `lightweight-charts` v5.1.0 | ~40-50 KB | TradingView charting, used only on `/symbols/[symbol]`. Should be dynamically imported |
| `lucide-react` v0.563.0 | ~2-5 KB per icon, potentially 200+ KB total | Without `optimizePackageImports`, may bundle more icons than needed |
| `radix-ui` v1.4.3 | ~15-30 KB | The meta-package imports everything |

### ISR vs Force-Dynamic Decisions

| Page | Current | Appropriate? | Recommendation |
|------|---------|-------------|----------------|
| `/` | ISR 60s | Yes, but neutralized | Fix `workerFetch`, keep ISR 60s |
| `/agents` | ISR 60s | Yes | Fix `workerFetch`, keep ISR 60s |
| `/agents/[agentId]` | ISR 30s | Yes | Fix `workerFetch`, deduplicate `getAgentDetail` call |
| `/agents/compare` | force-dynamic | **Yes** | Keep, add Redis caching |
| `/analytics` | force-dynamic | **No** | Switch to ISR 120s (data has 120s Redis TTL) |
| `/memecoins` | ISR 60s | Yes, but neutralized | Fix `workerFetch`, keep ISR 60s |
| `/tweets` | ISR 60s | Yes, but neutralized | Fix `workerFetch`, keep ISR 60s |
| `/processing` | ISR 30s | Yes, but neutralized | Fix `workerFetch`, keep ISR 30s |
| `/status` | force-dynamic | Debatable | Could use ISR 60s after workerFetch fix |
| `/backtest` | force-dynamic | Acceptable | Keep, add Redis cache |
| `/settings` | ISR 60s | Yes, but neutralized | Fix `workerFetch`, keep ISR 60s |
| `/symbols/[symbol]` | force-dynamic | **Yes** | Keep force-dynamic |
| `/updates` | Static | **Yes** | No change needed |

### SSE Implementation

Two SSE connections are always open on every page (trades + consensus) via root layout. Consider combining into a single multiplexed connection.

### Layout-Level Concerns

1. **`ConsensusBannerWrapper`** makes an uncached worker API call on every navigation
2. **`TradeNotificationWrapper`** makes 3 network requests on initial load (2 client fetches + 1 SSE)
3. Two Google Fonts loaded — consider if `Geist_Mono` is needed everywhere

### Section 1 Recommendations

1. **[CRITICAL]** Remove `revalidate: 0` from `workerFetch` — 80-90% API load reduction (1 line)
2. **[HIGH]** Switch `/analytics` from `force-dynamic` to ISR 120s
3. **[HIGH]** Add `optimizePackageImports` to `next.config.ts` — ~30-50 KB bundle reduction
4. **[HIGH]** Enable Partial Prerendering (PPR)
5. **[MEDIUM]** Add Redis caching to ~23 uncached query functions
6. **[MEDIUM]** Add security and cache headers to `vercel.json`
7. **[LOW]** Dynamically import `lightweight-charts` — ~40-50 KB saved
8. **[LOW]** Combine layout-level SSE streams

---

## SECTION 2: Backend Query Performance

### N+1 Query Inventory

Four distinct N+1 patterns generate hundreds of unnecessary database round-trips per cycle.

#### 2.1 SSE Broadcast Loop (`_broadcast_agent_update`)

**File:** `worker/src/main.py:199-303`
**Trigger:** Runs every 5 seconds

**Current code (lines 226-243):**
```python
for agent, portfolio in rows:          # ~28 iterations
    # Query 1: COUNT + FILTER per agent
    trade_result = await session.execute(
        select(
            func.count().label("total"),
            func.count().filter(AgentTrade.pnl > 0).label("wins"),
        ).where(AgentTrade.agent_id == agent.id)
    )
    # Query 2: SUM(estimated_cost_usd) per agent
    cost_result = await session.execute(
        select(func.coalesce(func.sum(AgentTokenUsage.estimated_cost_usd), 0))
        .where(AgentTokenUsage.agent_id == agent.id)
    )
```

**Problem:** 2 + 2N queries per cycle = ~58 queries every 5 seconds = **~700 queries/minute**

**Fix — Batch with GROUP BY:**
```python
# Before the loop: batch trade stats
trade_stats_result = await session.execute(
    select(
        AgentTrade.agent_id,
        func.count().label("total"),
        func.count().filter(AgentTrade.pnl > 0).label("wins"),
    ).group_by(AgentTrade.agent_id)
)
trade_stats = {row.agent_id: (row.total, row.wins) for row in trade_stats_result.all()}

# Before the loop: batch token costs
cost_stats_result = await session.execute(
    select(
        AgentTokenUsage.agent_id,
        func.coalesce(func.sum(AgentTokenUsage.estimated_cost_usd), 0).label("cost"),
    ).group_by(AgentTokenUsage.agent_id)
)
cost_stats = {row.agent_id: float(row.cost) for row in cost_stats_result.all()}

# Inside the loop: O(1) dict lookups
for agent, portfolio in rows:
    trade_count, wins = trade_stats.get(agent.id, (0, 0))
    total_token_cost = cost_stats.get(agent.id, 0.0)
```

**Impact:** ~58 -> 4 queries per cycle. Saves ~648 queries/minute.

#### 2.2 Leaderboard SQL (`LEADERBOARD_SQL`)

**File:** `worker/src/routers/agents.py:68-79`
**Trigger:** Every `/agents/leaderboard`, `/agents/discarded`, `/agents/{id}`, `/agents/compare`

**Current SQL:**
```sql
SELECT a.id, a.name, ...,
  (SELECT COUNT(*) FROM agent_trades WHERE agent_id = a.id) as trade_count,
  (SELECT COUNT(*) FILTER (WHERE pnl > 0) FROM agent_trades WHERE agent_id = a.id) as wins,
  (SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM agent_token_usage WHERE agent_id = a.id) as total_token_cost,
  (SELECT COUNT(*) FROM agent_positions WHERE agent_id = a.id) as open_positions
FROM agents a JOIN agent_portfolios p ON a.id = p.agent_id
```

**Problem:** 4 correlated subqueries x 124 agents = **496 subquery executions per request**

**Fix — Rewrite with LEFT JOIN aggregates:**
```sql
SELECT a.id, a.name, a.display_name, a.strategy_archetype, a.timeframe,
  a.engine, a.source, a.scan_model, a.trade_model, a.evolution_model,
  a.status, a.initial_balance, a.uuid, a.last_cycle_at,
  a.discarded_at, a.discard_reason,
  p.cash_balance, p.total_equity, p.total_realized_pnl, p.total_fees_paid,
  (p.total_equity - a.initial_balance) as total_pnl,
  COALESCE(t.trade_count, 0) as trade_count,
  COALESCE(t.wins, 0) as wins,
  COALESCE(tu.total_token_cost, 0) as total_token_cost,
  COALESCE(pos.open_positions, 0) as open_positions
FROM agents a
JOIN agent_portfolios p ON a.id = p.agent_id
LEFT JOIN (
    SELECT agent_id, COUNT(*) as trade_count,
           COUNT(*) FILTER (WHERE pnl > 0) as wins
    FROM agent_trades GROUP BY agent_id
) t ON t.agent_id = a.id
LEFT JOIN (
    SELECT agent_id, SUM(estimated_cost_usd) as total_token_cost
    FROM agent_token_usage GROUP BY agent_id
) tu ON tu.agent_id = a.id
LEFT JOIN (
    SELECT agent_id, COUNT(*) as open_positions
    FROM agent_positions GROUP BY agent_id
) pos ON pos.agent_id = a.id
```

**Impact:** 496 subquery executions -> 3 single scans total.

#### 2.3 Portfolio `update_unrealized_pnl` — Symbol N+1

**File:** `worker/src/agents/portfolio.py:415-460`

```python
for position in positions:
    result = await self.session.execute(
        select(Symbol).where(Symbol.id == position.symbol_id)
    )
    symbol = result.scalar_one()
```

**Problem:** ~372 individual symbol lookups per full cycle (124 agents x ~3 positions)

**Fix:** Batch-load with `Symbol.id.in_(symbol_ids)` before the loop.

#### 2.4 Portfolio `check_stop_loss_take_profit` — Symbol N+1

**File:** `worker/src/agents/portfolio.py:462-527`
Same pattern as 2.3. Same fix. ~372 more lookups per cycle.

#### 2.5 Portfolio `close_all_positions` — Symbol N+1

**File:** `worker/src/agents/portfolio.py:543-570`
Same pattern. Less frequent (only on pause).

#### 2.6 Portfolio `_get_symbol_id` — Repeated Uncached Lookups

**File:** `worker/src/agents/portfolio.py:636-641`
Called 2-3 times per trade action for the same symbol. Fix: instance-level cache dict.

### Missing Index Analysis

**Existing indexes are well-designed** — `agent_trades(agent_id)`, `agent_token_usage(agent_id)`, and `symbols(symbol)` are already covered by existing indexes or unique constraints.

**New indexes needed:**

```sql
-- agent_trades by symbol (for symbol activity endpoint joins)
CREATE INDEX idx_agent_trades_symbol ON agent_trades (symbol_id);

-- agent_positions by symbol (for symbol activity endpoint)
CREATE INDEX idx_agent_positions_symbol ON agent_positions (symbol_id);

-- agent_decisions by symbol (for decision joins)
CREATE INDEX idx_agent_decisions_symbol ON agent_decisions (symbol_id);

-- agents by status (frequently filtered)
CREATE INDEX idx_agents_status ON agents (status);

-- agents by engine+status (composite for engine+status filters)
CREATE INDEX idx_agents_engine_status ON agents (engine, status);
```

### Impact Estimates

| Metric | Before | After | Saved |
|--------|--------|-------|-------|
| SSE broadcast queries/min | ~700 | ~48 | ~93% |
| Leaderboard queries/request | ~496 | ~5 | ~99% |
| Portfolio symbol lookups/cycle | ~744+ | ~248 | ~67% |
| New indexes needed | 0 | 5 | — |

---

## SECTION 3: Caching Architecture

### Current Cache Coverage Map

| Endpoint | Web Cache (Redis) | Worker Cache | TTL | Gaps |
|---|---|---|---|---|
| `/agents/leaderboard` | 60s | None | 60s | workerFetch defeats Data Cache |
| `/agents/discarded` | 60s | None | 60s | Same |
| `/agents/{id}` | **None** | None | - | No cache at any layer |
| `/agents/{id}/trades` | **None** | None | - | Uncached, 200 rows |
| `/agents/{id}/decisions` | **None** | None | - | Uncached, 200 rows + reasoning text |
| `/agents/{id}/positions` | **None** | None | - | Uncached |
| `/analytics/*` (12 endpoints) | 120s | None | 120s | workerFetch defeats Data Cache |
| `/rankings` (all TFs) | **None** | None | - | Heaviest page, no cache |
| `/trades/recent` | **None** | None | - | CTE + 3-way JOIN per request |
| `/twitter/*` | **None** | None | - | All uncached |
| `/memecoins/*` (6 endpoints) | **None** | None | - | All uncached |
| `/consensus` | **None** | None | - | Uncached |
| `/processing/*` | **None** | None | - | Uncached |

**Summary**: Out of ~40 endpoints, only 17 have web-side Redis cache. **Zero** endpoints have worker-side response caching.

### workerFetch `revalidate: 0` Fix

**Current** (`web/src/lib/worker-client.ts:26`):
```typescript
next: { revalidate: 0 },  // defeats ALL caching
```

**Fix** — Per-call revalidation:
```typescript
interface WorkerFetchOptions extends RequestInit {
  revalidate?: number;  // seconds, default 30
}

async function workerFetch<T>(path: string, options: WorkerFetchOptions = {}): Promise<T> {
  const { revalidate = 30, ...fetchOptions } = options;
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...fetchOptions,
    next: { revalidate },
    headers: { "Content-Type": "application/json", ...fetchOptions.headers },
  });
  // ... error handling ...
}

export function workerGet<T>(path: string, revalidate?: number): Promise<T> {
  return workerFetch<T>(path, { method: "GET", revalidate });
}

export function workerPost<T>(path: string, body?: unknown): Promise<T> {
  return workerFetch<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined, revalidate: 0 });
}
```

### Worker-Side Response Cache Design

**`cached_response` decorator** for FastAPI endpoints:
```python
def cached_response(prefix: str, ttl: int = 30):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            key_parts = [prefix]
            for k, v in sorted(kwargs.items()):
                if v is not None:
                    key_parts.append(f"{k}={v}")
            cache_key = f"alpha:resp:{':'.join(key_parts)}"

            cached = await cache_get(cache_key)
            if cached is not None:
                return json.loads(cached)

            result = await func(*args, **kwargs)
            try:
                await cache_set(cache_key, json.dumps(result, default=str), ttl)
            except Exception:
                pass
            return result
        return wrapper
    return decorator
```

#### Per-Endpoint TTL Recommendations

| Endpoint Group | TTL | Rationale |
|---|---|---|
| `/rankings` | 30s | Updates every 15m (shortest TF) |
| `/agents/leaderboard` | 30s | Changes on trade close |
| `/agents/{id}` | 15s | Detail pages need fresher data |
| `/agents/{id}/positions` | 15s | Time-sensitive |
| `/analytics/*` | 300s | Aggregates over 90-day windows |
| `/trades/recent` | 15s | Live trades feed |
| `/twitter/*` | 60-120s | Periodic updates |
| `/memecoins/*` | 60-120s | Periodic updates |

### Cache Key Convention

```
alpha:resp:{endpoint_prefix}:{param1}={value1}:{param2}={value2}
```

### Invalidation Matrix (Event-Driven)

| Event | Caches to Invalidate |
|-------|---------------------|
| Pipeline completed | `alpha:resp:rankings:*` |
| Agent cycle completed | `alpha:resp:agents:*`, `alpha:resp:analytics:*`, `alpha:resp:trades:*`, `alpha:resp:consensus:*` |
| Trade opened | `alpha:resp:agents:positions:*`, `alpha:resp:agents:leaderboard`, `alpha:resp:trades:*` |
| Trade closed | `alpha:resp:agents:trades:*`, `alpha:resp:agents:leaderboard`, `alpha:resp:analytics:*` |
| New tweets | `alpha:resp:twitter:*` |
| Memecoin activity | `alpha:resp:memecoins:*` |

### Cache-Control Headers Middleware

```python
class CacheHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.method not in ("GET", "HEAD"):
            response.headers["Cache-Control"] = "no-store"
            return response
        # Match route prefix -> (s-maxage, stale-while-revalidate)
        # /analytics/ -> 120, 300
        # /rankings/ -> 30, 60
        # /agents/leaderboard -> 30, 60
        # /trades/ -> 15, 30
        # etc.
        return response
```

### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Worker API calls per page (rankings) | 6+ fresh | 0 (cache hit) |
| Worker API calls per page (analytics) | 12 Redis-backed | 0 (Data Cache) |
| Worker API calls per page (agent detail) | 6 fresh | 0-1 |
| P95 response time (rankings) | 200-400ms | 5-10ms |
| P95 response time (analytics) | 300-500ms | 5-10ms |

---

## SECTION 4: Infrastructure & Async

### Blocking Call Inventory

The worker runs on an async FastAPI stack, but three critical Claude API call sites use the **synchronous** `anthropic.Anthropic` client. Each sync `client.messages.create()` blocks the entire asyncio event loop for 2-15 seconds.

**Reference**: `worker/src/agents/postmortem.py:77` already uses `anthropic.AsyncAnthropic` correctly.

#### 4.1 executor.py — Claude API Decision (Critical)

**File**: `worker/src/agents/executor.py:87,118`

```python
# Line 87 — sync client
self.client = anthropic.Anthropic(api_key=api_key or settings.anthropic_api_key)

# Lines 118-125 — sync blocking call inside async method
response = self.client.messages.create(
    model=model, max_tokens=1024, system=system_prompt,
    tools=[TRADE_ACTION_TOOL],
    tool_choice={"type": "tool", "name": "trade_action"},
    messages=[{"role": "user", "content": user_message}],
)
```

**Impact**: Highest-frequency blocking call. With 30 LLM agents, event loop blocked for **60-450 seconds cumulatively** per cycle.

**Fix**: `anthropic.AsyncAnthropic` + `await client.messages.create()`

#### 4.2 memory.py — Trade Memory (Medium)

**File**: `worker/src/agents/memory.py:41,74`
Same pattern. Blocks 1-5 seconds per trade memory generation.

**Fix**: Same — `AsyncAnthropic` + `await`

#### 4.3 evolution.py — Agent Evolution (Low frequency, high latency)

**File**: `worker/src/agents/evolution.py:64,144`
Same pattern. `max_tokens=2048` means 5-20 seconds per call.

**Fix**: Same — `AsyncAnthropic` + `await`

#### 4.4 Additional Sync Clients

| File | Line |
|------|------|
| `worker/src/twitter/analyzer.py` | 105 |
| `worker/src/twitter/filter.py` | 129 |
| `worker/src/memecoins/tweet_analyzer.py` | 27 |
| `worker/src/memecoins/vip_analyzer.py` | 64 |
| `worker/src/memecoins/twitter_poller.py` | 261 |

### Connection Pool Analysis

**File**: `worker/src/db.py:17`

**Current**: `pool_size=5, max_overflow=10` = 15 max connections

**Problem**: 124 agents + pipelines + health checks + SSE can exhaust the pool. No `pool_pre_ping` means stale Neon connections cause `InterfaceError`.

**Recommended**:
```python
engine = create_async_engine(
    _url, echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,     # Prevents stale connection errors
    pool_recycle=300,        # Recycle every 5 minutes (Neon idle timeout)
)
```

### Fly.io Sizing

**File**: `worker/fly.toml:42-44`

**Current**: `shared-cpu-1x`, 1 GB memory

**Assessment**: Borderline adequate for sequential processing. After async migration with concurrent agents, needs upgrade.

**Recommended**: `shared-cpu-2x`, 2 GB memory (or `performance-1x` if cycle latency matters)

### Next.js Configuration Gaps

**Current** (`web/next.config.ts`): Only `reactCompiler: true`

**Recommended**:
```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
    ppr: 'incremental',
  },
};
```

### Security Headers

**Missing from `web/vercel.json`:**

```json
{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
  ]
}
```

### Compression

**Status**: GZipMiddleware is **NOT** enabled. JSON responses sent uncompressed.

**Fix**: `app.add_middleware(GZipMiddleware, minimum_size=1000)` — 70-85% bandwidth reduction.

### Async Migration Plan

1. **Phase 1**: Migrate `executor.py`, `memory.py`, `evolution.py` to `AsyncAnthropic` (3 lines per file)
2. **Phase 2**: Enable concurrent agent processing in `orchestrator.py` with `asyncio.Semaphore(5)`:
```python
sem = asyncio.Semaphore(5)
async def process_with_limit(agent):
    async with sem:
        return await self._process_agent(agent, ...)
results = await asyncio.gather(*[process_with_limit(a) for a in agents], return_exceptions=True)
```
3. **Phase 3**: Migrate secondary clients (`twitter/*.py`, `memecoins/*.py`)
4. **Phase 4**: Scale connection pool for concurrent access

---

## SECTION 5: Data Architecture

### Denormalization Design

Add four pre-aggregated columns to the `agents` table:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `trade_count` | integer | 0 | Total completed trades |
| `win_count` | integer | 0 | Trades with pnl > 0 |
| `total_token_cost_usd` | numeric(10,4) | 0.0 | Sum of all token costs |
| `open_position_count` | integer | 0 | Current open positions |

This eliminates:
- 4 correlated subqueries from `LEADERBOARD_SQL`
- ~56 queries from SSE broadcast loop
- Repeated aggregations across all agent endpoints

#### Alembic Migration

```python
"""Add denormalized stats columns to agents table."""

def upgrade() -> None:
    op.add_column("agents", sa.Column("trade_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("agents", sa.Column("win_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("agents", sa.Column("total_token_cost_usd", sa.Numeric(10, 4), nullable=False, server_default="0"))
    op.add_column("agents", sa.Column("open_position_count", sa.Integer(), nullable=False, server_default="0"))

    # Backfill from existing data
    op.execute(text("""UPDATE agents a SET trade_count = COALESCE(t.cnt, 0), win_count = COALESCE(t.wins, 0)
        FROM (SELECT agent_id, COUNT(*) as cnt, COUNT(*) FILTER (WHERE pnl > 0) as wins
              FROM agent_trades GROUP BY agent_id) t WHERE a.id = t.agent_id"""))
    op.execute(text("""UPDATE agents a SET total_token_cost_usd = COALESCE(u.total, 0)
        FROM (SELECT agent_id, SUM(estimated_cost_usd) as total
              FROM agent_token_usage GROUP BY agent_id) u WHERE a.id = u.agent_id"""))
    op.execute(text("""UPDATE agents a SET open_position_count = COALESCE(p.cnt, 0)
        FROM (SELECT agent_id, COUNT(*) as cnt
              FROM agent_positions GROUP BY agent_id) p WHERE a.id = p.agent_id"""))
```

#### Atomic Update Points

| Event | Location | Update |
|-------|----------|--------|
| Trade closed | `portfolio.py:381` | `trade_count += 1, win_count += (1 if pnl > 0), open_position_count -= 1` |
| Position opened | `portfolio.py:265` | `open_position_count += 1` |
| Token usage tracked | `orchestrator.py:701` | `total_token_cost_usd += cost` |

#### Data Consistency Safeguard

Daily reconciliation job at 03:00 UTC to fix any counter drift.

### SSE Broadcast Optimization

**Before**: 2 + 2N queries (~58 total, ~700/min)
**After**: 2 queries total (~24/min) — all stats come from denormalized `agents` columns

### API Batching — `/agents/{id}/full`

**Before**: 7 parallel HTTP round-trips from Vercel to Fly.io (~350-700ms overhead)
**After**: 1 composite endpoint with all data (~100-200ms)

### Rankings Optimization

Create a `latest_computation` lookup table (timeframe -> latest run_id + computed_at) updated on pipeline completion. Replaces `MAX(computed_at)` aggregate scans.

---

## PRIORITY MATRIX

| Priority | Finding | Impact | Effort | Phase |
|----------|---------|--------|--------|-------|
| **P0** | Remove `revalidate: 0` from `workerFetch` | 80-90% fewer worker API calls | 1 line | Phase 1 |
| **P0** | Batch SSE broadcast queries (GROUP BY) | 97% fewer SSE queries (700 -> 24/min) | 30 min | Phase 1 |
| **P0** | Rewrite LEADERBOARD_SQL with LEFT JOINs | 99% fewer subquery executions | 20 min | Phase 1 |
| **P0** | Migrate Claude API to AsyncAnthropic | Unblocks event loop, enables concurrency | 9 lines | Phase 1 |
| **P1** | Add `cached_response` decorator to worker endpoints | 90% fewer DB queries on cache hits | 1-2 days | Phase 1 |
| **P1** | Batch portfolio symbol lookups | 67% fewer symbol lookups per cycle | 20 min | Phase 1 |
| **P1** | Add 5 missing database indexes | Faster joins on symbol_id, status | 10 min | Phase 1 |
| **P1** | Add GZipMiddleware | 70-85% bandwidth reduction | 2 lines | Phase 1 |
| **P1** | Add security headers (`vercel.json`) | Security hardening | Config only | Phase 1 |
| **P1** | Optimize `next.config.ts` (PPR, optimizePackageImports) | 30-50 KB smaller bundles, faster TTFB | Config only | Phase 1 |
| **P1** | Switch `/analytics` to ISR 120s | Eliminates unnecessary re-renders | 1 line | Phase 1 |
| **P2** | Denormalize agent stats (4 columns) | Eliminates all correlated subqueries permanently | 2-3 days | Phase 2 |
| **P2** | Enable concurrent agent processing (Semaphore) | 5x faster agent cycles | 1 day | Phase 2 |
| **P2** | Tune connection pool (10/20, pre_ping, recycle) | Prevents stale connections, supports concurrency | 4 params | Phase 2 |
| **P2** | Scale Fly.io VM (2x CPU, 2 GB) | Headroom for concurrency | Config only | Phase 2 |
| **P2** | Add per-call `revalidate` to query files | Enables Data Cache per-endpoint | Series of small changes | Phase 2 |
| **P2** | Add event-driven cache invalidation | Fresher data with longer TTLs | 1 day | Phase 2 |
| **P3** | Rewrite SSE broadcast with denormalized columns | 97% reduction (after Phase 2 migration) | Low | Phase 3 |
| **P3** | Add composite `/agents/{id}/full` endpoint | 70% fewer HTTP round-trips on detail page | Medium | Phase 3 |
| **P3** | Add `latest_computation` lookup table | Eliminates MAX() scans | Low | Phase 3 |
| **P3** | Migrate secondary sync Claude clients | Event loop hygiene | Low-Medium | Phase 3 |
| **P3** | Dynamically import `lightweight-charts` | ~40-50 KB bundle savings | Low | Phase 3 |
| **P3** | Combine layout-level SSE streams | 1 fewer TCP connection per client | Low | Phase 3 |

---

## IMPLEMENTATION ROADMAP

### Phase 1: Quick Wins (1-2 days, zero schema changes)

These changes require no database migrations and can be deployed independently:

1. **Fix `workerFetch` `revalidate: 0`** — Remove or replace with default 30s in `web/src/lib/worker-client.ts:26`
2. **Batch SSE broadcast queries** — Add two GROUP BY queries before the loop in `worker/src/main.py:226-243`
3. **Rewrite LEADERBOARD_SQL** — Replace correlated subqueries with LEFT JOIN aggregates in `worker/src/routers/agents.py:68-79`
4. **Migrate 3 Claude API clients to async** — `executor.py:87,118`, `memory.py:41,74`, `evolution.py:64,144`
5. **Batch portfolio symbol lookups** — `portfolio.py:432-437`, `portfolio.py:479-484`, `portfolio.py:556-560`
6. **Add 5 missing database indexes** — Alembic migration with `CREATE INDEX CONCURRENTLY`
7. **Add GZipMiddleware** — 2 lines in `worker/src/main.py`
8. **Update `next.config.ts`** — Add `optimizePackageImports`, `poweredByHeader: false`, `ppr: 'incremental'`
9. **Update `vercel.json`** — Add security headers
10. **Switch `/analytics` to ISR 120s** — 1 line change

**Expected impact**: ~90% reduction in database queries, ~80% reduction in worker API calls, unblocked event loop.

### Phase 2: Schema & Infrastructure (2-3 days)

1. **Denormalization migration** — Add 4 columns to `agents`, backfill, update ORM
2. **Update LEADERBOARD_SQL** to read denormalized columns instead of LEFT JOINs
3. **Atomic counter updates** — Instrument `portfolio.py` and `orchestrator.py`
4. **Enable concurrent agent processing** — `asyncio.Semaphore(5)` in orchestrator
5. **Tune connection pool** — `pool_size=10, max_overflow=20, pool_pre_ping=True, pool_recycle=300`
6. **Scale Fly.io VM** — `shared-cpu-2x`, 2 GB
7. **Add `cached_response` decorator** to high-traffic worker endpoints
8. **Add Cache-Control headers middleware** to worker
9. **Add per-call `revalidate`** to all web query files
10. **Add event-driven cache invalidation** via `event_bus` hooks

**Expected impact**: Eliminates all correlated subqueries permanently, enables 5x concurrent agent processing.

### Phase 3: Architecture Optimization (3-5 days)

1. **Rewrite SSE broadcast** to use denormalized columns (2 queries instead of ~58)
2. **Add `/agents/{id}/full` composite endpoint** — Reduces 7 HTTP calls to 1
3. **Add `latest_computation` lookup table** — Simplifies rankings queries
4. **Migrate secondary sync Claude clients** — Twitter/memecoin analyzers
5. **Dynamic import `lightweight-charts`** — Bundle optimization
6. **Combine layout SSE streams** — Reduce connection overhead
7. **Daily reconciliation job** for denormalized counters

**Expected impact**: Optimal steady-state performance with minimal DB load, fast page loads, and concurrent agent processing.

---

*Report generated by Alpha Board Performance Audit Team — 2026-03-02*
