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
import { WalletLeaderboard } from "@/components/memecoins/wallet-leaderboard";
import { WalletActivityFeed } from "@/components/memecoins/wallet-activity-feed";
import { MemecoinAccountManager } from "@/components/memecoins/memecoin-account-manager";
import { MemecoinTweetFeed } from "@/components/memecoins/memecoin-tweet-feed";

/**
 * Memecoins Page (Server Component)
 *
 * Wallet cross-referencing leaderboard, live activity feed,
 * and memecoin-focused Twitter feed with token discovery.
 * ISR: Revalidates every 60 seconds.
 */

export const revalidate = 60;

export default async function MemecoinsPage() {
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
      // Use tracker price/mcap if available (more recent)
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
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Memecoins</h1>
        <p className="mt-1 text-sm text-secondary">
          Wallet cross-referencing, live activity monitoring, and memecoin Twitter intelligence.
        </p>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Trending Tokens */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium text-primary">Trending Tokens</h2>
          <p className="mt-0.5 text-xs text-muted">Most mentioned tokens in the last 24 hours</p>
        </div>
        <TrendingTokens tokens={enrichedTokens} />
      </section>

      {/* Section 1: Watch Wallets */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-primary">Watch Wallets</h2>
        <WalletLeaderboard initialWallets={wallets} />
        <WalletActivityFeed initialActivity={walletActivity} />
      </section>

      {/* Section 2: Memecoin Twitter Feed */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-primary">Memecoin Twitter</h2>
        <MemecoinAccountManager initialAccounts={twitterAccounts} />
        <MemecoinTweetFeed initialTweets={tweets} />
      </section>
    </div>
  );
}
