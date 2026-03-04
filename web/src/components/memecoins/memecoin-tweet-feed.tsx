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
  caller: "text-text-secondary",
  influencer: "text-text-secondary",
  degen: "text-data-loss",
  news: "text-text-secondary",
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
          <h3 className="text-sm font-medium text-text-primary">Recent Tweets</h3>
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isConnected ? "bg-[#10B981]" : "bg-[#52525B]"
            }`}
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`rounded px-2 py-1 text-xs transition-colors-fast ${
              filter === "all"
                ? "bg-void-muted text-text-primary"
                : "text-text-secondary hover:text-text-primary"
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
                  ? "bg-void-muted text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tweet list */}
      {filtered.length === 0 ? (
        <div className="rounded-none border border-void-border bg-void-surface px-4 py-8 text-center text-sm text-text-tertiary">
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
  bullish: "bg-terminal-amber-muted text-data-profit border-void-border",
  bearish: "bg-terminal-amber-muted text-data-loss border-void-border",
  neutral: "bg-void-muted text-text-secondary border-void-border",
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
  long_entry: "bg-terminal-amber-muted text-data-profit",
  short_entry: "bg-terminal-amber-muted text-data-loss",
  take_profit: "bg-void-muted text-terminal-amber",
  warning: "bg-void-muted text-terminal-amber",
  neutral: "bg-void-muted text-text-secondary",
  informational: "bg-void-muted text-text-secondary",
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
    CATEGORY_COLORS[tweet.accountCategory] || "text-text-secondary";
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
    <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
      <div className="min-w-0">
        {/* Author line */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {tweet.accountDisplayName}
          </span>
          <span className="text-xs text-text-tertiary">@{tweet.accountHandle}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${categoryColor}`}
          >
            {MEMECOIN_CATEGORY_LABELS[tweet.accountCategory]}
          </span>
          {tweet.isVip && (
            <Star className="h-3 w-3 fill-terminal-amber text-terminal-amber" />
          )}
        </div>

        {/* Tweet text */}
        <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap break-words">
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
                  className="w-full rounded-none border border-void-border object-contain bg-black/20"
                  style={{
                    maxHeight: mediaUrls.length === 1 ? "512px" : "260px",
                  }}
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}

        {/* Metrics row */}
        <div className="mt-2 flex items-center gap-4 text-xs text-text-tertiary">
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
            <div className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
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
          <div className="mt-2.5 rounded-none border border-void-border bg-void-muted px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">
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

              <span className="text-xs text-text-tertiary ml-auto">
                conf {(signal.confidence * 100).toFixed(0)}%
              </span>
            </div>

            {signal.symbolsMentioned && signal.symbolsMentioned.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs text-text-tertiary">Symbols:</span>
                {signal.symbolsMentioned.map((sym) => (
                  <span
                    key={sym}
                    className="rounded bg-void-surface px-1.5 py-0.5 text-xs font-mono font-medium text-text-secondary"
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
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors-fast"
                >
                  {showReasoning ? "Hide reasoning" : "Show reasoning"}
                </button>
                {showReasoning && (
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    {signal.reasoning}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2.5 rounded-none border border-dashed border-void-border px-3 py-2 text-xs text-text-tertiary">
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
