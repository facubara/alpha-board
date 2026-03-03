# Alpha Board — Project Instructions

## Deployment

### Auto-deploy rule
Whenever code changes are committed that affect the **worker** (anything under `worker/`), automatically redeploy to Fly.io:
```
cd worker && fly deploy
```
If database migrations were added, run them after deploy:
```
fly ssh console -a alpha-worker -C "cd /app && alembic upgrade head"
```

Whenever code changes are committed that affect the **web** (anything under `web/`), Vercel deploys automatically on push to `master`. No manual step needed — but wait for the build to succeed and verify.

Do NOT ask "should I deploy?" — just deploy after pushing. Deployment is always expected.

### Migrations
Always run `alembic upgrade head` on the worker after deploying a migration. Never leave a migration unapplied.

## Testing & Verification

### Web/UI changes
When changes affect the frontend (`web/`), always use **Playwright MCP** to:
1. Navigate to the deployed page
2. Take a screenshot to verify the UI renders correctly
3. Check for console errors or broken elements
4. Report findings with the screenshot

Do NOT skip visual verification for UI changes. Use Playwright MCP — don't just assume it works.

### Worker/API changes
When changes affect the worker (`worker/`), verify by hitting the relevant API endpoint (e.g., `/health`, `/debug/agents/{timeframe}`, `/trigger/{timeframe}`) using WebFetch after deploy.

## URLs

- **Production site**: https://alpha-board.com
- **Worker API**: https://alpha-worker.fly.dev

Always use `https://alpha-board.com` for Playwright verification — never guess the URL.

## Architecture

- **worker/** — Python FastAPI worker on Fly.io (APScheduler, Binance pipeline, agent orchestrator)
- **web/** — Next.js dashboard on Vercel (Neon Postgres, server components)
- **Database** — Neon Postgres, shared by both. Migrations in `worker/alembic/versions/`

## Next Steps Tracking

The file `next-steps.md` in the project root lists upcoming features. Each feature heading includes a status tag: `PENDING`, `IN PROGRESS`, or `COMPLETED`.

When a feature from `next-steps.md` is fully implemented and deployed, update its heading status from `PENDING` (or `IN PROGRESS`) to `COMPLETED`. Do this immediately after the work is done — do not ask, just update the file.

## Changelog / Updates Page

Every user-facing change (new feature, significant fix, UI overhaul) **must** get a changelog entry in `web/src/lib/data/changelog.ts`. Add it immediately after the work is deployed — do not ask, just add it.

Entry format:
```ts
{ date: "YYYY-MM-DD", title: "Short Feature Name", description: "One-liner summarizing what changed and why it matters to users." }
```

Prepend new entries to the top of the array (newest first). Keep descriptions concise — one sentence, two max.

## Rules — Always Do

- **Summarize changes for the Updates page** — every deployed feature/fix gets a changelog entry (see above).
- **Verify after deploy** — never assume a deploy worked. Use Playwright for web, WebFetch for API.
- **Run migrations immediately** — if a migration was added, run `alembic upgrade head` on the worker right after deploy.
- **Update `next-steps.md`** — mark features as `COMPLETED` the moment they're deployed.
- **Commit messages use conventional commits** — `feat:`, `fix:`, `perf:`, `chore:`, etc.

## Rules — Never Do

- **Don't skip visual verification** — if UI changed, screenshot it with Playwright MCP. No exceptions.
- **Don't leave migrations unapplied** — deploy + migrate is one atomic operation.
- **Don't ask "should I deploy?"** — deployment is always expected after pushing changes.
- **Don't introduce N+1 queries** — batch-fetch or join instead. If you add a DB query inside a loop, stop and refactor.
- **Don't hardcode secrets or API keys** — always use environment variables.
- **Don't add dependencies without justification** — prefer using what's already in the project. If a new package is truly needed, mention why.
- **Don't install Playwright** — Playwright MCP is already available as a tool. Never run `npx playwright install`, `npm install playwright`, or any Playwright install command. Just use the MCP browser tools directly.

## Season Transitions

When a season ends, follow this process:

1. **Generate review docs** under `docs/season-N/`:
   - `_index.md` scorecard — fleet summary table with per-agent verdicts (KEEP / TUNE / DISCARD)
   - Individual agent `.md` files — performance metrics, strengths/weaknesses, trade analysis, verdict + rationale
   - See `docs/season-1/` as the format reference

2. **Apply verdicts** via Alembic migration:
   - DISCARD agents → `status='discarded'` with reason
   - TUNE agents → parameter changes (prompt tweaks, threshold adjustments)

3. **Archive + reset** via Alembic migration:
   - Snapshot end-of-season portfolios into `agent_season_snapshots` table
   - Tag all existing trades with the ending season number (`season` column on `agent_trades`)
   - Force-close open positions as `exit_reason='season_reset'`
   - Reset all active agent portfolios to $10k equity, zero PnL

4. **Add a changelog entry** to `web/src/lib/data/changelog.ts` summarizing the season transition

5. **Deploy + migrate** — deploy worker, run `alembic upgrade head`, push web changes

## Conventions

- Commit messages follow conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- Worker timeframes: 15m, 30m, 1h, 4h, 1d
- Agent engines: `rule` (deterministic Python) and `llm` (Claude API)
