import { getTwitterAccounts, getRecentTweets, getTweetStats } from "@/lib/queries/tweets";
import { TweetFeed } from "@/components/tweets/tweet-feed";
import { AccountManager } from "@/components/tweets/account-manager";

/**
 * Tweets Page (Server Component)
 *
 * Shows tracked Twitter accounts and live tweet feed with sentiment signals.
 * ISR: Revalidates every 60 seconds.
 */

export const revalidate = 60;

const SETUP_LABELS: Record<string, string> = {
  long_entry: "Long Entry",
  short_entry: "Short Entry",
  take_profit: "Take Profit",
  warning: "Warning",
  neutral: "Neutral",
  informational: "Info",
};

export default async function TweetsPage() {
  const [accounts, tweets, stats] = await Promise.all([
    getTwitterAccounts(),
    getRecentTweets(50),
    getTweetStats(),
  ]);

  const { signalStats } = stats;
  const sentimentColor =
    signalStats.avgSentiment > 0.2
      ? "text-bullish"
      : signalStats.avgSentiment < -0.2
        ? "text-bearish"
        : "text-secondary";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Twitter Feed</h1>
        <p className="mt-1 text-sm text-secondary">
          Tracking {stats.accounts} accounts &middot; {stats.totalTweets} tweets ingested &middot; {stats.last24h > 0 ? `${stats.last24h} in last 24h` : "Feed paused"}
        </p>
      </div>

      {/* Signal Stats */}
      {signalStats.analyzed > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-xs text-muted">Analyzed</div>
            <div className="mt-1 text-lg font-semibold text-primary">{signalStats.analyzed}</div>
          </div>
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-xs text-muted">Avg Sentiment</div>
            <div className={`mt-1 text-lg font-semibold ${sentimentColor}`}>
              {signalStats.avgSentiment > 0 ? "+" : ""}{signalStats.avgSentiment.toFixed(3)}
            </div>
          </div>
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 sm:col-span-2">
            <div className="text-xs text-muted">Signal Breakdown</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(signalStats.setupBreakdown).map(([type, count]) => (
                <span key={type} className="text-xs text-secondary">
                  {SETUP_LABELS[type] || type}: <span className="font-medium text-primary">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Account Manager */}
      <AccountManager initialAccounts={accounts} />

      {/* Tweet Feed */}
      <TweetFeed initialTweets={tweets} />
    </div>
  );
}
