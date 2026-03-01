import { Suspense } from "react";
import Link from "next/link";
import { getAllTimeframeRankings } from "@/lib/queries/rankings";
import { RankingsTable } from "@/components/rankings";

// ISR configuration: revalidate every 60 seconds
export const revalidate = 60;

/**
 * Async server component that fetches rankings.
 * Wrapped in Suspense so the page shell streams immediately.
 */
async function RankingsSection() {
  const rankings = await getAllTimeframeRankings();
  return <RankingsTable data={rankings} />;
}

/**
 * Rankings table skeleton — shown while data streams in.
 */
function RankingsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Timeframe selector skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-14 rounded-md bg-[var(--bg-muted)] skeleton" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
        {/* Header */}
        <div className="flex h-10 items-center gap-4 bg-[var(--bg-surface)] px-4">
          <div className="h-3 w-8 rounded bg-[var(--bg-muted)] skeleton" />
          <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
          <div className="h-3 w-24 rounded bg-[var(--bg-muted)] skeleton" />
          <div className="h-3 w-12 rounded bg-[var(--bg-muted)] skeleton" />
        </div>
        {/* Rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex h-10 items-center gap-4 border-t border-[var(--border-subtle)] px-4"
          >
            <div className="h-3 w-6 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="h-3 w-24 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="h-1.5 w-24 rounded-full bg-[var(--bg-muted)] skeleton" />
            <div className="h-3 w-10 rounded bg-[var(--bg-muted)] skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}

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

      {/* Rankings table — streams in via Suspense */}
      <Suspense fallback={<RankingsSkeleton />}>
        <RankingsSection />
      </Suspense>
    </div>
  );
}
