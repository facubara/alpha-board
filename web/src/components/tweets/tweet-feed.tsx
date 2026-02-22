"use client";

/**
 * TweetFeed — Live tweet feed with SSE updates.
 *
 * Displays tweets in reverse chronological order.
 * Subscribes to /sse/tweets for real-time updates.
 */

import { useState, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { TweetData, TweetSetupType, TwitterAccountCategory } from "@/lib/types";
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

const SENTIMENT_COLORS = {
  bullish: "bg-green-500/15 text-green-400 border-green-500/30",
  bearish: "bg-red-500/15 text-red-400 border-red-500/30",
  neutral: "bg-gray-500/15 text-gray-400 border-gray-500/30",
} as const;

const SETUP_LABELS: Record<TweetSetupType, string> = {
  long_entry: "Long Entry",
  short_entry: "Short Entry",
  take_profit: "Take Profit",
  warning: "Warning",
  neutral: "Neutral",
  informational: "Info",
};

const SETUP_COLORS: Record<TweetSetupType, string> = {
  long_entry: "bg-green-500/15 text-green-400",
  short_entry: "bg-red-500/15 text-red-400",
  take_profit: "bg-yellow-500/15 text-yellow-400",
  warning: "bg-orange-500/15 text-orange-400",
  neutral: "bg-gray-500/15 text-gray-400",
  informational: "bg-blue-500/15 text-blue-400",
};

function getSentimentLabel(score: number): "bullish" | "bearish" | "neutral" {
  if (score > 0.2) return "bullish";
  if (score < -0.2) return "bearish";
  return "neutral";
}

function SentimentBar({ score }: { score: number }) {
  // score is -1 to +1, map to 0-100%
  const pct = Math.round((score + 1) * 50);
  const label = getSentimentLabel(score);
  const barColor =
    label === "bullish"
      ? "bg-green-500"
      : label === "bearish"
        ? "bg-red-500"
        : "bg-gray-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted tabular-nums w-8 text-right">
        {score > 0 ? "+" : ""}{score.toFixed(2)}
      </span>
    </div>
  );
}

function ConfidenceDots({ confidence }: { confidence: number }) {
  // confidence is 0-1, show as 5 dots
  const filled = Math.round(confidence * 5);
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            i < filled ? "bg-blue-400" : "bg-[var(--bg-elevated)]"
          }`}
        />
      ))}
    </span>
  );
}

function TweetCard({ tweet }: { tweet: TweetData }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const categoryColor = CATEGORY_COLORS[tweet.accountCategory] || "text-secondary";
  const timeAgo = getTimeAgo(tweet.createdAt);
  const mediaUrls = tweet.metrics.media_urls || [];
  const signal = tweet.signal;

  // Strip trailing t.co URLs when we have media to show
  const displayText = mediaUrls.length > 0
    ? tweet.text.replace(/\s*https:\/\/t\.co\/\w+\s*$/g, "").trim()
    : tweet.text;

  const sentimentLabel = signal ? getSentimentLabel(signal.sentimentScore) : null;

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
                  className="w-full rounded-md border border-[var(--border-default)] object-contain bg-black/20"
                  style={{ maxHeight: mediaUrls.length === 1 ? "512px" : "260px" }}
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

        {/* AI Analysis section */}
        {signal ? (
          <div className="mt-2.5 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted uppercase tracking-wide mb-2">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-blue-400 shrink-0">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM8 4a.75.75 0 01.75.75v2.5h2.5a.75.75 0 010 1.5h-2.5v2.5a.75.75 0 01-1.5 0v-2.5h-2.5a.75.75 0 010-1.5h2.5v-2.5A.75.75 0 018 4z"/>
              </svg>
              AI Analysis
            </div>

            {/* Top row: sentiment + setup + confidence */}
            <div className="flex items-center gap-3 mb-1.5">
              {/* Sentiment badge */}
              {sentimentLabel && (
                <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${SENTIMENT_COLORS[sentimentLabel]}`}>
                  {sentimentLabel.charAt(0).toUpperCase() + sentimentLabel.slice(1)}
                </span>
              )}

              {/* Setup type */}
              {signal.setupType && (
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${SETUP_COLORS[signal.setupType]}`}>
                  {SETUP_LABELS[signal.setupType]}
                </span>
              )}

              {/* Confidence */}
              <span className="flex items-center gap-1.5 text-[10px] text-muted ml-auto">
                conf <ConfidenceDots confidence={signal.confidence} />
              </span>
            </div>

            {/* Sentiment bar */}
            <SentimentBar score={signal.sentimentScore} />

            {/* Symbols row */}
            {signal.symbolsMentioned && signal.symbolsMentioned.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] text-muted">Symbols:</span>
                {signal.symbolsMentioned.map((sym) => (
                  <span key={sym} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-secondary">
                    {sym}
                  </span>
                ))}
              </div>
            )}

            {/* Reasoning */}
            {signal.reasoning && (
              <div className="mt-2">
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors-fast"
                >
                  {showReasoning ? "Hide reasoning" : "Show reasoning"}
                </button>
                {showReasoning && (
                  <p className="mt-1 text-xs text-secondary leading-relaxed">
                    {signal.reasoning}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2.5 rounded border border-dashed border-[var(--border-default)] px-3 py-2 text-[10px] text-muted">
            Pending analysis...
          </div>
        )}
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
