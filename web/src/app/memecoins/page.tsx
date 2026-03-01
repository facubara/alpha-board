import { Suspense } from "react";
import {
  getWatchWallets,
  getRecentWalletActivity,
  getMemecoinTwitterAccounts,
  getRecentMemecoinTweets,
  getMemecoinStats,
  getTrendingTokens,
  getTrackedTokens,
  getBatchTokenSnapshots,
} from "@/lib/queries/memecoins";
import type { EnrichedToken } from "@/lib/types";
import { StatsBar } from "@/components/memecoins/stats-bar";
import { TrendingTokens } from "@/components/memecoins/trending-tokens";
import { WalletTabs } from "@/components/memecoins/wallet-tabs";
import { MemecoinAccountManager } from "@/components/memecoins/memecoin-account-manager";
import { MemecoinTweetFeed } from "@/components/memecoins/memecoin-tweet-feed";
import MemecoinsLoading from "./loading";

export const revalidate = 60;

/**
 * Async section that fetches all memecoins data.
 * Wrapped in Suspense so the page header renders instantly.
 */
async function MemecoinsContent() {
  const [wallets, walletActivity, twitterAccounts, tweets, stats, trendingTokens, trackedTokens] =
    await Promise.all([
      getWatchWallets(),
      getRecentWalletActivity(50),
      getMemecoinTwitterAccounts(),
      getRecentMemecoinTweets(50),
      getMemecoinStats(),
      getTrendingTokens(24),
      getTrackedTokens(),
    ]);

  // Fetch snapshots for tracked tokens
  const trackerIds = trackedTokens.map((t) => t.id);
  const snapshotMap = await getBatchTokenSnapshots(trackerIds);

  // Build a lookup from mint → tracker data
  const trackerByMint = new Map(trackedTokens.map((t) => [t.mintAddress, t]));

  // Merge trending + tracked into EnrichedToken[]
  const seenMints = new Set<string>();
  const enrichedTokens: EnrichedToken[] = [];

  // Twitter-sourced trending tokens first (ranked)
  for (const tt of trendingTokens) {
    seenMints.add(tt.tokenMint);
    const tracker = trackerByMint.get(tt.tokenMint);
    enrichedTokens.push({
      ...tt,
      trackerId: tracker?.id ?? null,
      source: tracker?.source ?? null,
      refreshIntervalMinutes: tracker?.refreshIntervalMinutes ?? 15,
      latestHolders: tracker?.latestHolders ?? null,
      latestVolume24hUsd: tracker?.latestVolume24hUsd ?? null,
      lastRefreshedAt: tracker?.lastRefreshedAt ?? null,
      priceUsd: tracker?.latestPriceUsd ?? tt.priceUsd,
      marketCapUsd: tracker?.latestMcapUsd ?? tt.marketCapUsd,
      liquidityUsd: tracker?.latestLiquidityUsd ?? tt.liquidityUsd,
      snapshots: tracker ? (snapshotMap.get(tracker.id) ?? []) : [],
    });
  }

  // Manual tokens appended at the end
  for (const tracker of trackedTokens) {
    if (seenMints.has(tracker.mintAddress)) continue;
    enrichedTokens.push({
      rank: 0,
      tokenSymbol: tracker.symbol ?? "???",
      tokenName: tracker.name,
      tokenMint: tracker.mintAddress,
      mentionCount: 0,
      marketCapUsd: tracker.latestMcapUsd,
      priceUsd: tracker.latestPriceUsd,
      liquidityUsd: tracker.latestLiquidityUsd,
      birdeyeUrl: `https://birdeye.so/token/${tracker.mintAddress}?chain=solana`,
      trackerId: tracker.id,
      source: tracker.source,
      refreshIntervalMinutes: tracker.refreshIntervalMinutes,
      latestHolders: tracker.latestHolders,
      latestVolume24hUsd: tracker.latestVolume24hUsd,
      lastRefreshedAt: tracker.lastRefreshedAt,
      snapshots: snapshotMap.get(tracker.id) ?? [],
    });
  }

  return (
    <>
      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Two-column command center */}
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Left column — data tables & management (60%) */}
        <div className="space-y-6 md:w-3/5">
          {/* Trending Tokens */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-medium text-primary">Trending Tokens</h2>
              <p className="mt-0.5 text-xs text-muted">Most mentioned tokens in the last 24 hours</p>
            </div>
            <TrendingTokens tokens={enrichedTokens} />
          </section>

          {/* Watch Wallets (tabbed) */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-primary">Watch Wallets</h2>
            <WalletTabs wallets={wallets} activity={walletActivity} />
          </section>

          {/* Tracked Accounts */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-primary">Tracked Accounts</h2>
            <MemecoinAccountManager initialAccounts={twitterAccounts} />
          </section>
        </div>

        {/* Right column — tweet feed (40%), sticky on desktop */}
        <div className="md:w-2/5">
          <div className="md:sticky md:top-[72px] md:max-h-[calc(100vh-72px-24px)] md:overflow-y-auto md:border-l md:border-[var(--border-default)] md:pl-6">
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-primary">Memecoin Twitter</h2>
              <MemecoinTweetFeed initialTweets={tweets} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function MemecoinsContentSkeleton() {
  return (
    <>
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3"
          >
            <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="mt-2 h-5 w-12 rounded bg-[var(--bg-muted)] skeleton" />
          </div>
        ))}
      </div>

      {/* Two-column skeleton */}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="space-y-6 md:w-3/5">
          {/* Trending Tokens */}
          <section className="space-y-4">
            <div>
              <div className="h-5 w-36 rounded bg-[var(--bg-muted)] skeleton" />
              <div className="mt-1 h-3 w-64 rounded bg-[var(--bg-muted)] skeleton" />
            </div>
            <div className="overflow-x-auto rounded-md border border-[var(--border-default)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-t border-[var(--border-default)] px-3 py-2 first:border-t-0">
                  <div className="h-3 w-6 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-4 w-20 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-16 rounded bg-[var(--bg-muted)] skeleton" />
                  <div className="h-3 w-20 rounded bg-[var(--bg-muted)] skeleton" />
                </div>
              ))}
            </div>
          </section>

          {/* Watch Wallets */}
          <section className="space-y-4">
            <div className="h-5 w-32 rounded bg-[var(--bg-muted)] skeleton" />
            <div className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] skeleton" />
          </section>
        </div>

        {/* Right column skeleton */}
        <div className="md:w-2/5">
          <div className="space-y-4 md:border-l md:border-[var(--border-default)] md:pl-6">
            <div className="h-5 w-32 rounded bg-[var(--bg-muted)] skeleton" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
                <div className="h-4 w-28 rounded bg-[var(--bg-muted)] skeleton" />
                <div className="mt-2 h-3 w-full rounded bg-[var(--bg-muted)] skeleton" />
                <div className="mt-1 h-3 w-3/4 rounded bg-[var(--bg-muted)] skeleton" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function MemecoinsPage() {
  return (
    <div className="space-y-6">
      {/* Header renders instantly */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Memecoins</h1>
        <p className="mt-1 text-sm text-secondary">
          Track smart wallets, analyze early buyers, and cross-reference memecoin signals
        </p>
      </div>

      <Suspense fallback={<MemecoinsContentSkeleton />}>
        <MemecoinsContent />
      </Suspense>
    </div>
  );
}
