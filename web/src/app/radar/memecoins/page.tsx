import { Suspense } from "react";
import { PageHeader } from "@/components/terminal";
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

export const revalidate = 30;

/**
 * Async section that fetches all memecoins data.
 * Wrapped in Suspense so the page header renders instantly.
 */
async function MemecoinsContent() {
  const results = await Promise.allSettled([
    getWatchWallets(),
    getRecentWalletActivity(50),
    getMemecoinTwitterAccounts(),
    getRecentMemecoinTweets(50),
    getMemecoinStats(),
    getTrendingTokens(24),
    getTrackedTokens(),
  ]);

  const wallets = results[0].status === "fulfilled" ? results[0].value : [];
  const walletActivity = results[1].status === "fulfilled" ? results[1].value : [];
  const twitterAccounts = results[2].status === "fulfilled" ? results[2].value : [];
  const tweets = results[3].status === "fulfilled" ? results[3].value : [];
  const stats = results[4].status === "fulfilled" ? results[4].value : { walletsTracked: 0, avgHitRate: 0, tweetsToday: 0, tokenMatchesToday: 0 };
  const trendingTokens = results[5].status === "fulfilled" ? results[5].value : [];
  const trackedTokens = results[6].status === "fulfilled" ? results[6].value : [];

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
              <h2 className="text-lg font-medium text-text-primary">Trending Tokens</h2>
              <p className="mt-0.5 text-xs text-text-tertiary">Most mentioned tokens in the last 24 hours</p>
            </div>
            <TrendingTokens tokens={enrichedTokens} />
          </section>

          {/* Watch Wallets (tabbed) */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-text-primary">Watch Wallets</h2>
            <WalletTabs wallets={wallets} activity={walletActivity} />
          </section>

          {/* Tracked Accounts */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-text-primary">Tracked Accounts</h2>
            <MemecoinAccountManager initialAccounts={twitterAccounts} />
          </section>
        </div>

        {/* Right column — tweet feed (40%), sticky on desktop */}
        <div className="md:w-2/5">
          <div className="md:sticky md:top-[72px] md:max-h-[calc(100vh-72px-24px)] md:overflow-y-auto md:border-l md:border-void-border md:pl-6">
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-text-primary">Memecoin Twitter</h2>
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
            className="rounded-none border border-void-border bg-void-surface px-4 py-3"
          >
            <div className="h-3 w-20 rounded-none bg-void-muted skeleton" />
            <div className="mt-2 h-5 w-12 rounded-none bg-void-muted skeleton" />
          </div>
        ))}
      </div>

      {/* Two-column skeleton */}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="space-y-6 md:w-3/5">
          {/* Trending Tokens */}
          <section className="space-y-4">
            <div>
              <div className="h-5 w-36 rounded-none bg-void-muted skeleton" />
              <div className="mt-1 h-3 w-64 rounded-none bg-void-muted skeleton" />
            </div>
            <div className="overflow-x-auto rounded-none border border-void-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-t border-void-border px-3 py-2 first:border-t-0">
                  <div className="h-3 w-6 rounded-none bg-void-muted skeleton" />
                  <div className="h-4 w-20 rounded-none bg-void-muted skeleton" />
                  <div className="h-3 w-16 rounded-none bg-void-muted skeleton" />
                  <div className="h-3 w-20 rounded-none bg-void-muted skeleton" />
                </div>
              ))}
            </div>
          </section>

          {/* Watch Wallets */}
          <section className="space-y-4">
            <div className="h-5 w-32 rounded-none bg-void-muted skeleton" />
            <div className="h-9 w-full rounded-none border border-void-border bg-void-surface skeleton" />
          </section>
        </div>

        {/* Right column skeleton */}
        <div className="md:w-2/5">
          <div className="space-y-4 md:border-l md:border-void-border md:pl-6">
            <div className="h-5 w-32 rounded-none bg-void-muted skeleton" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-none border border-void-border bg-void-surface px-4 py-3">
                <div className="h-4 w-28 rounded-none bg-void-muted skeleton" />
                <div className="mt-2 h-3 w-full rounded-none bg-void-muted skeleton" />
                <div className="mt-1 h-3 w-3/4 rounded-none bg-void-muted skeleton" />
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
      <PageHeader title="Memecoins" subtitle="Track smart wallets, analyze early buyers, and cross-reference memecoin signals" />

      <Suspense fallback={<MemecoinsContentSkeleton />}>
        <MemecoinsContent />
      </Suspense>
    </div>
  );
}
