export type ChangelogEntry = {
  date: string;
  title: string;
  description: string;
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-02-22",
    title: "Trending Tokens",
    description:
      "Ranked table of the most-mentioned tokens from the Twitter feed in the last 24 hours. Deduplicates copy tokens by picking the highest-liquidity mint per symbol, with direct Birdeye links.",
  },
  {
    date: "2026-02-21",
    title: "Memecoins Tab — Wallet Intel & Twitter Feed",
    description:
      "New Memecoins page with wallet cross-referencing leaderboard, live activity feed, tracked Twitter accounts, tweet ingestion with token discovery, and real-time stats.",
  },
  {
    date: "2026-02-20",
    title: "Tweet Relevance Filter",
    description:
      "Two-tier filter at ingestion time — keyword heuristics plus Claude Haiku fallback — to discard irrelevant tweets before they hit the DB or waste analysis cost.",
  },
  {
    date: "2026-02-18",
    title: "Client-Side Live uPnL",
    description:
      "Replaced SSE-based unrealized PnL with direct Binance REST price fetching. Prices load in under 1 second and recalculate every 5s across all agent views.",
  },
  {
    date: "2026-02-16",
    title: "Progressive Pause All LLM Agents",
    description:
      "New modal pauses agents one by one with a progress bar and ASCII spinner. Includes localStorage resume so partial failures can be retried.",
  },
  {
    date: "2026-02-14",
    title: "LLM Cost Control — Per-Section Toggles",
    description:
      "Granular on/off switches for all 6 LLM call sites (decisions, evolution, post-mortem, memory, tweet sentiment, rules) with cost breakdown on the Settings page.",
  },
  {
    date: "2026-02-10",
    title: "Agent Integrity Audit & Telegram Parity",
    description:
      "Separated realized vs unrealized PnL, added agent UUIDs, timestamps on all actions, PnL reconciliation checks, and full Telegram notification parity with the web UI.",
  },
  {
    date: "2026-02-06",
    title: "Explanatory Tooltips & Hints",
    description:
      "Hover tooltips on every rankings column header, score bar, highlight chip, and indicator row — the dashboard is now self-documenting for new users.",
  },
  {
    date: "2026-02-02",
    title: "System Status Page",
    description:
      "Dedicated /status page with 90-day uptime heatmaps, live health checks for all 8 services, and auto-detected incident history.",
  },
  {
    date: "2026-01-28",
    title: "Agent Comparison & Analytics",
    description:
      "Side-by-side agent comparison with overlaid equity curves, plus a full analytics dashboard with PnL breakdowns by archetype, timeframe, and source.",
  },
];
