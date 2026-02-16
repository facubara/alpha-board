import { getTwitterAccounts, getRecentTweets, getTweetStats } from "@/lib/queries/tweets";
import { TweetFeed } from "@/components/tweets/tweet-feed";
import { AccountManager } from "@/components/tweets/account-manager";

/**
 * Tweets Page (Server Component)
 *
 * Shows tracked Twitter accounts and live tweet feed.
 * ISR: Revalidates every 60 seconds.
 */

export const revalidate = 60;

export default async function TweetsPage() {
  const [accounts, tweets, stats] = await Promise.all([
    getTwitterAccounts(),
    getRecentTweets(50),
    getTweetStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Twitter Feed</h1>
        <p className="mt-1 text-sm text-secondary">
          Tracking {stats.accounts} accounts &middot; {stats.totalTweets} tweets ingested &middot; {stats.last24h} in last 24h
        </p>
      </div>

      {/* Account Manager */}
      <AccountManager initialAccounts={accounts} />

      {/* Tweet Feed */}
      <TweetFeed initialTweets={tweets} />
    </div>
  );
}
