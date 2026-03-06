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

---

## Design Philosophy: "High-Fidelity Terminal"
The UI must look like a proprietary Bloomberg Terminal or a secure server command line. It is **NOT** a friendly Web2 SaaS. It is a precision instrument for financial execution.
*   **Vibe:** Mathematical, raw, dense, data-heavy, brutalist.
*   **Shapes:** Hardware-like. Everything is perfectly square (`rounded-none`). Absolutely no `rounded-lg` or `rounded-full` (except for literal dot-matrix dots).
*   **Shadows:** NONE. No drop shadows. UI depth is created entirely through 1px borders (`border-void-border`).

---

## UI Strict Rules (Never Do This)

⚠️ **NEVER USE NATIVE SCROLLBARS.**
If a container requires scrolling (`overflow-y-auto`), you MUST apply the `.terminal-scroll` custom class to hide default chunky browser scrollbars. 

⚠️ **NEVER USE BLOG-STYLE LAYOUTS.**
Do not constrain page content to the center of the screen using `max-w-2xl`, `max-w-3xl`, or `max-w-4xl`. This is a trading dashboard. Use full-width layouts: `w-full max-w-[1800px] mx-auto px-4`.

⚠️ **NEVER USE SOLID PROGRESS BARS.**
Do not use `bg-gray-800` solid divs for progress. Always use the custom `<DottedProgress>` component.

⚠️ **NEVER USE GENERIC FONTS FOR DATA/HEADERS.**
Do not use `font-sans` for page headers, table data, or numbers. If it is a number, a ticker, a timestamp, or a primary layout header (e.g., `>_ TERMINAL`), it MUST be `font-mono`.

⚠️ **NEVER USE DEFAULT NEON COLORS.**
Do not use default Tailwind `text-red-500` or `text-green-500`. Only use our custom `text-data-profit` and `text-data-loss` variables.

---

## Typography System

We use a strict two-font system to balance terminal aesthetics with readability.

*   **`font-mono` (Geist Mono / JetBrains):** 
    *   **Use for:** All numbers, PnL, Tickers, Timestamps, Table Data, Page Headers (e.g., `>_ SEASONS`), Buttons, and exact AI outputs.
    *   **Styling:** Often paired with `uppercase tracking-widest text-xs` for labels/headers.
*   **`font-sans` (Geist Sans / Inter):**
    *   **Use for:** Only for long-form reading paragraphs, marketing copy, or secondary description text where monospace would cause eye strain.

---

## Color System Reference

Always use these custom Tailwind variables defined in our `tailwind.config.js`:

*   **Backgrounds:** 
    *   `bg-void` (#0A0A0A) - The absolute background.
    *   `bg-void-surface` (#121212) - The background for all cards, tables, and panels.
*   **Borders:** 
    *   `border-void-border` (#27272A) - Used for ALL structural lines and dividers.
*   **Text:** 
    *   `text-text-primary` (#E4E4E7) - Primary data and headers. (Never use pure #FFF).
    *   `text-text-secondary` (#A1A1AA) - Standard labels.
    *   `text-text-tertiary` (#52525B) - Muted/inactive elements.
*   **Accents & Data:**
    *   `text-terminal-amber` (#FFB000) - Primary Brand Color, CTAs, Active States.
    *   `text-data-profit` (#10B981) - Positive PnL, Longs, Success states.
    *   `text-data-loss` (#F43F5E) - Negative PnL, Shorts, Error states.

---

## Custom Component Library

When building UI, check if one of these custom components should be used instead of raw HTML:

1.  **`<DottedAvatar agentId="..." />`**
    *   *Use:* Always use this next to an Agent's name. Never use plain text or image avatars.
2.  **`<DottedProgress progress={50} />`**
    *   *Use:* For any percentage, season progress, or loading bar.
3.  **`<DottedLoader />`**
    *   *Use:* Instead of spinning circles or `[ \ ]` text for processing/running states.
4.  **`<InteractiveGrid>` vs `.bg-dot-matrix`**
    *   *Use:* `InteractiveGrid` is ONLY for the unauthenticated Landing Page. Authenticated app layouts strictly use the static `.bg-dot-matrix` class on the root body.

---

## Global CSS Utilities

Ensure you are using the custom scrollbar utility for any scrolling panels:

```css
@layer utilities {
  .terminal-scroll::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  .terminal-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .terminal-scroll::-webkit-scrollbar-thumb {
    background-color: #27272A;
    border-radius: 0px;
  }
  .terminal-scroll::-webkit-scrollbar-thumb:hover {
    background-color: #52525B;
  }
  /* Hide scrollbar entirely for absolute clean looks when needed */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}