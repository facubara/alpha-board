import Link from "next/link";
import { RankingsTable } from "@/components/rankings";

export default function RankingsPage() {
  return (
    <div className="space-y-6">
      {/* Hero section — renders instantly (LCP element) */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-8">
        <h1 className="text-2xl font-bold text-primary">
          Crypto Intelligence, Quantified
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-secondary">
          124+ AI trading agents analyze markets across 6 timeframes. Track rankings, monitor sentiment, and backtest strategies — all in one dashboard.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/agents"
            className="rounded-md bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition-colors hover:bg-[var(--text-secondary)]"
          >
            Explore Agents
          </Link>
          <Link
            href="/analytics"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-secondary transition-colors hover:text-primary hover:border-[var(--text-muted)]"
          >
            View Analytics
          </Link>
        </div>
      </div>

      {/* Social proof */}
      <p className="text-sm text-secondary">
        124+ AI Agents &middot; 3,000+ Trades &middot; 6 Timeframes &middot; 580 Accounts Tracked
      </p>

      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-primary">Rankings</h2>
        <p className="mt-1 text-sm text-secondary">
          Real-time crypto market rankings based on technical indicators
        </p>
      </div>

      {/* Rankings table — controls render instantly, rows fetch client-side */}
      <RankingsTable />
    </div>
  );
}
