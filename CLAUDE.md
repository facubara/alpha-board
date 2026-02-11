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

## Architecture

- **worker/** — Python FastAPI worker on Fly.io (APScheduler, Binance pipeline, agent orchestrator)
- **web/** — Next.js dashboard on Vercel (Neon Postgres, server components)
- **Database** — Neon Postgres, shared by both. Migrations in `worker/alembic/versions/`

## Conventions

- Commit messages follow conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- Worker timeframes: 15m, 30m, 1h, 4h, 1d, 1w
- Agent engines: `rule` (deterministic Python) and `llm` (Claude API)
