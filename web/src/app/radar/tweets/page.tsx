import { Suspense } from "react";
import { PageHeader } from "@/components/terminal";
import { getTwitterAccounts, getRecentTweets, getTweetStats } from "@/lib/queries/tweets";
import { TweetFeed } from "@/components/tweets/tweet-feed";
import { AccountManager } from "@/components/tweets/account-manager";

export const revalidate = 60;

const SETUP_LABELS: Record<string, string> = {
  long_entry: "Long Entry",
  short_entry: "Short Entry",
  take_profit: "Take Profit",
  warning: "Warning",
  neutral: "Neutral",
  informational: "Info",
};

/**
 * Async section that fetches all tweets data.
 * Wrapped in Suspense so page header renders instantly.
 */
async function TweetsContent() {
  const [accounts, tweets, stats] = await Promise.all([
    getTwitterAccounts(),
    getRecentTweets(50),
    getTweetStats(),
  ]);

  const { signalStats } = stats;
  const sentimentColor =
    signalStats.avgSentiment > 0.2
      ? "text-data-profit"
      : signalStats.avgSentiment < -0.2
        ? "text-data-loss"
        : "text-text-secondary";

  return (
    <>
      {/* Stats subtitle */}
      <p className="mt-1 text-sm text-text-secondary">
        Tracking {stats.accounts} accounts &middot; {stats.totalTweets} tweets ingested &middot; {stats.last24h > 0 ? `${stats.last24h} in last 24h` : "Feed paused"}
      </p>

      {/* Signal Stats */}
      {signalStats.analyzed > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
            <div className="text-xs text-text-tertiary">Analyzed</div>
            <div className="mt-1 text-lg font-semibold text-text-primary">{signalStats.analyzed}</div>
          </div>
          <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
            <div className="text-xs text-text-tertiary">Avg Sentiment</div>
            <div className={`mt-1 text-lg font-semibold ${sentimentColor}`}>
              {signalStats.avgSentiment > 0 ? "+" : ""}{signalStats.avgSentiment.toFixed(3)}
            </div>
          </div>
          <div className="rounded-none border border-void-border bg-void-surface px-4 py-3 sm:col-span-2">
            <div className="text-xs text-text-tertiary">Signal Breakdown</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(signalStats.setupBreakdown).map(([type, count]) => (
                <span key={type} className="text-xs text-text-secondary">
                  {SETUP_LABELS[type] || type}: <span className="font-medium text-text-primary">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Account Manager */}
      <div className="mt-6">
        <AccountManager initialAccounts={accounts} />
      </div>

      {/* Tweet Feed */}
      <div className="mt-6">
        <TweetFeed initialTweets={tweets} />
      </div>
    </>
  );
}

function TweetsContentSkeleton() {
  return (
    <>
      <div className="mt-1 h-4 w-72 rounded-none bg-void-muted skeleton" />

      {/* Signal stats cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-none border border-void-border bg-void-surface px-4 py-3"
          >
            <div className="h-3 w-16 rounded-none bg-void-muted skeleton" />
            <div className="mt-2 h-5 w-12 rounded-none bg-void-muted skeleton" />
          </div>
        ))}
      </div>

      {/* Account cards */}
      <div className="mt-6 space-y-3">
        <div className="h-5 w-40 rounded-none bg-void-muted skeleton" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 w-48 shrink-0 rounded-none border border-void-border bg-void-surface skeleton"
            />
          ))}
        </div>
      </div>

      {/* Tweet feed */}
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-none border border-void-border bg-void-surface p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-void-muted skeleton" />
              <div className="h-4 w-28 rounded-none bg-void-muted skeleton" />
              <div className="h-3 w-16 rounded-none bg-void-muted skeleton" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full rounded-none bg-void-muted skeleton" />
              <div className="h-3 w-3/4 rounded-none bg-void-muted skeleton" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function TweetsPage() {
  return (
    <div>
      <PageHeader title="Twitter Feed" />

      <Suspense fallback={<TweetsContentSkeleton />}>
        <TweetsContent />
      </Suspense>
    </div>
  );
}
