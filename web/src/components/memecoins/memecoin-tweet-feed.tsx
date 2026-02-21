"use client";

/**
 * MemecoinTweetFeed — Tweet feed with SSE updates and token match cards.
 */

import { useState, useCallback } from "react";
import { Star } from "lucide-react";
import { useSSE } from "@/hooks/use-sse";
import { TokenMatchCard } from "./token-match-card";
import type {
  MemecoinTweetData,
  MemecoinCategory,
  TweetSetupType,
} from "@/lib/types";
import { MEMECOIN_CATEGORY_LABELS } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

const CATEGORY_COLORS: Record<MemecoinCategory, string> = {
  caller: "text-orange-400",
  influencer: "text-purple-400",
  degen: "text-red-400",
  news: "text-yellow-400",
};

interface MemecoinTweetSSEEvent {
  type: string;
  tweets?: MemecoinTweetData[];
}

interface MemecoinTweetFeedProps {
  initialTweets: MemecoinTweetData[];
}

export function MemecoinTweetFeed({ initialTweets }: MemecoinTweetFeedProps) {
  const [tweets, setTweets] = useState<MemecoinTweetData[]>(initialTweets);
  const [filter, setFilter] = useState<MemecoinCategory | "all">("all");

  const handleSSE = useCallback((event: MemecoinTweetSSEEvent) => {
    if (event.type === "tweet_update" && event.tweets) {
      setTweets((prev) => {
        const existingIds = new Set(prev.map((t) => t.tweetId));
        const newTweets = event.tweets!.filter(
          (t) => !existingIds.has(t.tweetId)
        );
        if (newTweets.length === 0) return prev;
        return [...newTweets, ...prev].slice(0, 200);
      });
    }
  }, []);

  const { isConnected } = useSSE<MemecoinTweetSSEEvent>({
    url: `${WORKER_URL}/sse/memecoins`,
    enabled: !!WORKER_URL,
    onMessage: handleSSE,
  });

  const filtered =
    filter === "all"
      ? tweets
      : tweets.filter((t) => t.accountCategory === filter);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-primary">Recent Tweets</h3>
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-500"
            }`}
          />
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
          {(
            Object.entries(MEMECOIN_CATEGORY_LABELS) as [
              MemecoinCategory,
              string,
            ][]
          ).map(([cat, label]) => (
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
          ))}
        </div>
      </div>

      {/* Tweet list */}
      {filtered.length === 0 ? (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-muted">
          No memecoin tweets yet. Add accounts and trigger a poll.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tweet) => (
            <MemecoinTweetCard key={tweet.tweetId} tweet={tweet} />
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

function getSentimentLabel(
  score: number
): "bullish" | "bearish" | "neutral" {
  if (score > 0.2) return "bullish";
  if (score < -0.2) return "bearish";
  return "neutral";
}

function MemecoinTweetCard({ tweet }: { tweet: MemecoinTweetData }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const categoryColor =
    CATEGORY_COLORS[tweet.accountCategory] || "text-secondary";
  const timeAgo = getTimeAgo(tweet.createdAt);
  const mediaUrls = tweet.metrics.media_urls || [];
  const signal = tweet.signal;
  const tokenMatches = tweet.tokenMatches || [];

  const displayText =
    mediaUrls.length > 0
      ? tweet.text.replace(/\s*https:\/\/t\.co\/\w+\s*$/g, "").trim()
      : tweet.text;

  const sentimentLabel = signal
    ? getSentimentLabel(signal.sentimentScore)
    : null;

  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="min-w-0">
        {/* Author line */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary">
            {tweet.accountDisplayName}
          </span>
          <span className="text-xs text-muted">@{tweet.accountHandle}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryColor}`}
          >
            {MEMECOIN_CATEGORY_LABELS[tweet.accountCategory]}
          </span>
          {tweet.isVip && (
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          )}
        </div>

        {/* Tweet text */}
        <p className="mt-1 text-sm text-secondary whitespace-pre-wrap break-words">
          {displayText}
        </p>

        {/* Media images */}
        {mediaUrls.length > 0 && (
          <div
            className={`mt-2 grid gap-1 ${
              mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
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
                  style={{
                    maxHeight: mediaUrls.length === 1 ? "300px" : "200px",
                  }}
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
        </div>

        {/* Token Matches */}
        {tokenMatches.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            <div className="text-[10px] font-medium text-muted uppercase tracking-wide">
              Token Matches
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tokenMatches.map((match) => (
                <TokenMatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis section */}
        {signal ? (
          <div className="mt-2.5 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted uppercase tracking-wide mb-2">
              AI Analysis
            </div>

            <div className="flex items-center gap-3 mb-1.5">
              {sentimentLabel && (
                <span
                  className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${SENTIMENT_COLORS[sentimentLabel]}`}
                >
                  {sentimentLabel.charAt(0).toUpperCase() +
                    sentimentLabel.slice(1)}
                </span>
              )}

              {signal.setupType && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${SETUP_COLORS[signal.setupType]}`}
                >
                  {SETUP_LABELS[signal.setupType]}
                </span>
              )}

              <span className="text-[10px] text-muted ml-auto">
                conf {(signal.confidence * 100).toFixed(0)}%
              </span>
            </div>

            {signal.symbolsMentioned && signal.symbolsMentioned.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-muted">Symbols:</span>
                {signal.symbolsMentioned.map((sym) => (
                  <span
                    key={sym}
                    className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-secondary"
                  >
                    {sym}
                  </span>
                ))}
              </div>
            )}

            {signal.reasoning && (
              <div className="mt-1.5">
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
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
