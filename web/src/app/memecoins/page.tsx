import {
  getWatchWallets,
  getRecentWalletActivity,
  getMemecoinTwitterAccounts,
  getRecentMemecoinTweets,
  getMemecoinStats,
  getTrendingTokens,
} from "@/lib/queries/memecoins";
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
  const [wallets, walletActivity, twitterAccounts, tweets, stats, trendingTokens] =
    await Promise.all([
      getWatchWallets(),
      getRecentWalletActivity(50),
      getMemecoinTwitterAccounts(),
      getRecentMemecoinTweets(50),
      getMemecoinStats(),
      getTrendingTokens(24),
    ]);

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
        <TrendingTokens tokens={trendingTokens} />
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
