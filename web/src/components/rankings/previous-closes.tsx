"use client";

/**
 * PreviousCloses Component
 *
 * Shows historical snapshots for a symbol in a timeframe.
 * Lazily fetches on mount, collapsible, with selectable count (3/5/7/10).
 */

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HighlightChips } from "./highlight-chip";
import type {
  Timeframe,
  PreviousClosesData,
  PreviousClose,
  CloseCount,
} from "@/lib/types";
import { CLOSE_COUNTS } from "@/lib/types";

interface PreviousClosesProps {
  symbolId: number;
  symbol: string;
  timeframe: Timeframe;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score < 0.4) return "text-bearish";
  if (score > 0.6) return "text-bullish";
  return "text-muted";
}

function formatUtcTime(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${mon} ${day} ${h}:${m} UTC`;
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return `${Math.floor(diffD / 7)}w ago`;
}

function CloseRow({ close }: { close: PreviousClose }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1 text-xs">
      {/* Score */}
      <span
        className={cn(
          "w-12 shrink-0 text-right font-mono font-semibold tabular-nums",
          getScoreColor(close.bullishScore)
        )}
      >
        .{(close.bullishScore * 1000).toFixed(0).padStart(3, "0")}
      </span>

      {/* Price change % */}
      <span className="w-16 shrink-0 text-right font-mono tabular-nums">
        {close.priceChangePct != null ? (
          <span
            className={
              close.priceChangePct >= 0 ? "text-bullish" : "text-bearish"
            }
          >
            {close.priceChangePct >= 0 ? "+" : ""}
            {close.priceChangePct.toFixed(2)}%
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </span>

      {/* Highlights */}
      <span className="min-w-0 flex-1">
        <HighlightChips highlights={close.highlights} max={3} />
      </span>

      {/* Timestamp */}
      <span className="shrink-0 font-mono text-muted">
        {formatUtcTime(close.computedAt)}{" "}
        <span className="hidden sm:inline text-muted/60">
          ({formatRelativeTime(close.computedAt)})
        </span>
      </span>
    </div>
  );
}

export function PreviousCloses({
  symbolId,
  symbol,
  timeframe,
  className,
}: PreviousClosesProps) {
  const [expanded, setExpanded] = useState(false);
  const [count, setCount] = useState<CloseCount>(5);
  const [data, setData] = useState<PreviousClosesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const hasFetched = useRef(false);

  // Fetch when expanded for the first time, or when count changes while expanded
  useEffect(() => {
    if (!expanded) return;

    let cancelled = false;
    // Keep previous data visible during refresh (no flicker)
    if (!hasFetched.current) {
      setLoading(true);
    }
    setError(false);

    fetch(
      `/api/rankings/${timeframe}/history/${symbolId}?count=${count}`
    )
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((json: PreviousClosesData) => {
        if (!cancelled) {
          setData(json);
          hasFetched.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expanded, count, symbolId, timeframe]);

  return (
    <div className={cn("py-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-left text-xs text-secondary hover:text-primary"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150",
              !expanded && "-rotate-90"
            )}
          />
          <span>
            Previous Closes{" "}
            <span className="text-muted">({count})</span>
          </span>
        </button>

        {/* Count selector */}
        {expanded && (
          <div className="flex gap-0.5">
            {CLOSE_COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => setCount(c)}
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-xs transition-colors",
                  c === count
                    ? "bg-[var(--bg-surface)] text-primary ring-1 ring-[var(--border-strong)]"
                    : "text-muted hover:text-secondary"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div className="mt-2">
          {loading && !data ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-[var(--bg-muted)]"
                  style={{ width: `${60 + i * 10}%` }}
                />
              ))}
            </div>
          ) : error ? (
            <p className="py-1 text-xs text-muted">
              Failed to load previous closes
            </p>
          ) : data && data.closes.length === 0 ? (
            <p className="py-1 text-xs text-muted">
              No previous closes available for {symbol}
            </p>
          ) : data ? (
            <div className="space-y-0">
              {data.closes.map((close, i) => (
                <CloseRow key={`${close.computedAt}-${i}`} close={close} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
