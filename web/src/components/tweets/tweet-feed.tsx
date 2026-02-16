"use client";

/**
 * TweetFeed — Live tweet feed with SSE updates.
 *
 * Displays tweets in reverse chronological order.
 * Subscribes to /sse/tweets for real-time updates.
 */

import { useState, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { TweetData, TwitterAccountCategory } from "@/lib/types";
import { TWITTER_CATEGORY_LABELS } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

const CATEGORY_COLORS: Record<TwitterAccountCategory, string> = {
  analyst: "text-blue-400",
  founder: "text-purple-400",
  news: "text-yellow-400",
  degen: "text-red-400",
  insider: "text-green-400",
  protocol: "text-cyan-400",
};

interface TweetSSEEvent {
  type: string;
  tweets?: TweetData[];
}

interface TweetFeedProps {
  initialTweets: TweetData[];
}

export function TweetFeed({ initialTweets }: TweetFeedProps) {
  const [tweets, setTweets] = useState<TweetData[]>(initialTweets);
  const [filter, setFilter] = useState<TwitterAccountCategory | "all">("all");

  const handleSSEMessage = useCallback((event: TweetSSEEvent) => {
    if (event.type === "tweet_update" && event.tweets) {
      setTweets((prev) => {
        const existingIds = new Set(prev.map((t) => t.tweetId));
        const newTweets = event.tweets!.filter((t) => !existingIds.has(t.tweetId));
        if (newTweets.length === 0) return prev;
        return [...newTweets, ...prev].slice(0, 200);
      });
    }
  }, []);

  const { isConnected } = useSSE<TweetSSEEvent>({
    url: `${WORKER_URL}/sse/tweets`,
    enabled: !!WORKER_URL,
    onMessage: handleSSEMessage,
  });

  const filtered = filter === "all"
    ? tweets
    : tweets.filter((t) => t.accountCategory === filter);

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-primary">Recent Tweets</h2>
          <span className={`inline-block h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-500"}`} />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`rounded px-2 py-1 text-xs transition-colors-fast ${
              filter === "all"
                ? "bg-[var(--bg-elevated)] text-primary"
                : "text-secondary hover:text-primary"
            }`}
          >
            All
          </button>
          {(Object.entries(TWITTER_CATEGORY_LABELS) as [TwitterAccountCategory, string][]).map(
            ([cat, label]) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded px-2 py-1 text-xs transition-colors-fast ${
                  filter === cat
                    ? "bg-[var(--bg-elevated)] text-primary"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Tweet list */}
      {filtered.length === 0 ? (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-muted">
          No tweets yet. Add accounts and trigger a poll to start ingesting.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tweet) => (
            <TweetCard key={tweet.tweetId} tweet={tweet} />
          ))}
        </div>
      )}
    </div>
  );
}

function TweetCard({ tweet }: { tweet: TweetData }) {
  const categoryColor = CATEGORY_COLORS[tweet.accountCategory] || "text-secondary";
  const timeAgo = getTimeAgo(tweet.createdAt);
  const mediaUrls = tweet.metrics.media_urls || [];

  // Strip trailing t.co URLs when we have media to show
  const displayText = mediaUrls.length > 0
    ? tweet.text.replace(/\s*https:\/\/t\.co\/\w+\s*$/g, "").trim()
    : tweet.text;

  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="min-w-0">
        {/* Author line */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary">
            {tweet.accountDisplayName}
          </span>
          <span className="text-xs text-muted">@{tweet.accountHandle}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryColor}`}>
            {TWITTER_CATEGORY_LABELS[tweet.accountCategory]}
          </span>
        </div>

        {/* Tweet text */}
        <p className="mt-1 text-sm text-secondary whitespace-pre-wrap break-words">
          {displayText}
        </p>

        {/* Media images */}
        {mediaUrls.length > 0 && (
          <div className={`mt-2 grid gap-1 ${mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {mediaUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-full rounded-md border border-[var(--border-default)] object-cover"
                  style={{ maxHeight: mediaUrls.length === 1 ? "300px" : "200px" }}
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}

        {/* Metrics row */}
        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span>{timeAgo}</span>
          {tweet.metrics.like_count != null && (
            <span>{formatMetric(tweet.metrics.like_count)} likes</span>
          )}
          {tweet.metrics.retweet_count != null && (
            <span>{formatMetric(tweet.metrics.retweet_count)} RTs</span>
          )}
          {tweet.metrics.reply_count != null && (
            <span>{formatMetric(tweet.metrics.reply_count)} replies</span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMetric(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getTimeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
