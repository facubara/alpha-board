"use client";

/**
 * TrendingTokens — Enhanced ranked table with holder counts, volume,
 * sparklines, source badges, per-token refresh intervals, and manual add.
 * Clickable rows open a modal showing which accounts mentioned the token.
 */

import { useState, useEffect, useCallback, useTransition } from "react";
import { ExternalLink, Star, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EnrichedToken, TokenMention, MemecoinCategory } from "@/lib/types";
import { MEMECOIN_CATEGORY_LABELS, TRACKER_REFRESH_INTERVALS } from "@/lib/types";
import { HolderSparkline } from "./holder-sparkline";

const CATEGORY_BADGE_COLORS: Record<MemecoinCategory, string> = {
  caller: "bg-terminal-amber-muted text-terminal-amber border-terminal-amber/20",
  influencer: "bg-terminal-amber-muted text-terminal-amber border-terminal-amber/20",
  degen: "bg-terminal-amber-muted text-data-loss border-void-border",
  news: "bg-terminal-amber-muted text-terminal-amber border-terminal-amber/20",
};

interface TrendingTokensProps {
  tokens: EnrichedToken[];
}

export function TrendingTokens({ tokens }: TrendingTokensProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localTokens, setLocalTokens] = useState(tokens);
  const [selectedToken, setSelectedToken] = useState<EnrichedToken | null>(null);
  const [mentions, setMentions] = useState<TokenMention[]>([]);
  const [loadingMentions, setLoadingMentions] = useState(false);

  // Add token form
  const [mintInput, setMintInput] = useState("");
  const [intervalInput, setIntervalInput] = useState(15);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Sync with server data when props change
  useEffect(() => {
    setLocalTokens(tokens);
  }, [tokens]);

  const closeModal = useCallback(() => setSelectedToken(null), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeModal]);

  async function handleTokenClick(token: EnrichedToken) {
    if (token.mentionCount === 0) return;
    setSelectedToken(token);
    setLoadingMentions(true);
    try {
      const res = await fetch(`/api/memecoins/tokens/${encodeURIComponent(token.tokenSymbol)}/mentions`);
      if (res.ok) {
        setMentions(await res.json());
      }
      setLoadingMentions(false);
    } catch {
      setLoadingMentions(false);
    }
  }

  async function handleAddToken(e: React.FormEvent) {
    e.preventDefault();
    const mint = mintInput.trim();
    if (!mint) return;

    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/memecoins/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint_address: mint,
          refresh_interval_minutes: intervalInput,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error || data.detail || "Failed to add token");
      } else {
        setMintInput("");
        startTransition(() => router.refresh());
      }
    } catch {
      setAddError("Network error");
    }
    setAdding(false);
  }

  async function handleDelete(mint: string) {
    // Optimistic removal from local state
    setLocalTokens((prev) => prev.filter((t) => t.tokenMint !== mint));
    try {
      const res = await fetch(`/api/memecoins/tracker/${encodeURIComponent(mint)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        startTransition(() => router.refresh());
      } else {
        // Revert on failure
        setLocalTokens(tokens);
      }
    } catch {
      setLocalTokens(tokens);
    }
  }

  async function handleIntervalChange(mint: string, interval: number) {
    try {
      await fetch(`/api/memecoins/tracker/${encodeURIComponent(mint)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_interval_minutes: interval }),
      });
    } catch {
      // Silently fail
    }
  }

  return (
    <>
      {/* Add Token Bar */}
      <form
        onSubmit={handleAddToken}
        className="flex items-center gap-2 rounded-none border border-void-border bg-void-surface px-3 py-2"
      >
        <Plus className="h-4 w-4 text-text-tertiary shrink-0" />
        <input
          type="text"
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          placeholder="Paste mint address to track..."
          className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary outline-none min-w-0"
        />
        <select
          value={intervalInput}
          onChange={(e) => setIntervalInput(Number(e.target.value))}
          className="rounded bg-void-muted border border-void-border px-1.5 py-0.5 text-xs text-text-secondary outline-none"
        >
          {TRACKER_REFRESH_INTERVALS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={adding || !mintInput.trim()}
          className="rounded bg-terminal-amber px-2.5 py-1 text-xs font-medium text-void disabled:opacity-50"
        >
          {adding ? "..." : "Add"}
        </button>
        {addError && (
          <span className="text-xs text-data-loss shrink-0">{addError}</span>
        )}
      </form>

      {/* Token Table */}
      {localTokens.length === 0 ? (
        <div className="rounded-none border border-void-border bg-void-surface px-4 py-8 text-center text-sm text-text-tertiary">
          No tokens tracked yet. Add a mint address above or wait for Twitter discovery.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-none border border-void-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-void-border bg-void-surface">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary w-8">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Token</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary">Mentions</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary">Price</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary">Market Cap</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary">Holders</th>
                <th className="hidden md:table-cell px-3 py-2 text-right text-xs font-medium text-text-tertiary">Vol 24h</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-text-tertiary">Source</th>
                <th className="hidden md:table-cell px-3 py-2 text-center text-xs font-medium text-text-tertiary">Interval</th>
                <th className="px-3 py-2 text-xs font-medium text-text-tertiary w-16"></th>
              </tr>
            </thead>
            <tbody>
              {localTokens.map((token, i) => (
                <tr
                  key={token.tokenMint}
                  onClick={() => handleTokenClick(token)}
                  className={`border-b border-void-border hover:bg-void-muted ${token.mentionCount > 0 ? "cursor-pointer" : ""}`}
                >
                  <td className="px-3 py-2 text-text-tertiary">
                    {token.rank > 0 ? token.rank : i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      ${token.tokenSymbol}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {token.mentionCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-terminal-amber-muted px-2 py-0.5 text-xs font-medium text-terminal-amber">
                        {token.mentionCount}
                      </span>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary font-mono text-xs">
                    {token.priceUsd != null ? `$${formatPrice(token.priceUsd)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary text-xs">
                    {token.marketCapUsd != null ? formatMcap(token.marketCapUsd) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {token.latestHolders != null ? (
                        <span className="text-xs text-text-secondary tabular-nums">
                          {token.latestHolders.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs text-text-tertiary">—</span>
                      )}
                      <HolderSparkline snapshots={token.snapshots} />
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-2 text-right text-text-secondary text-xs">
                    {token.latestVolume24hUsd != null ? formatMcap(token.latestVolume24hUsd) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <SourceBadge source={token.source} />
                  </td>
                  <td className="hidden md:table-cell px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    {token.trackerId != null ? (
                      <select
                        value={token.refreshIntervalMinutes}
                        onChange={(e) =>
                          handleIntervalChange(token.tokenMint, Number(e.target.value))
                        }
                        className="rounded bg-void-muted border border-void-border px-1 py-0.5 text-xs text-text-secondary outline-none"
                      >
                        {TRACKER_REFRESH_INTERVALS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <a
                        href={token.birdeyeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-tertiary hover:text-text-primary transition-colors-fast"
                        title="View on Birdeye"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {token.trackerId != null && (
                        <button
                          onClick={() => handleDelete(token.tokenMint)}
                          className="text-text-tertiary hover:text-data-loss transition-colors-fast"
                          title="Remove token"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Token Mentions Modal */}
      {selectedToken && (
        <div
          role="dialog"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }}
        >
          <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-none border border-void-border bg-void flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-void-border px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-text-primary">${selectedToken.tokenSymbol}</span>
                {selectedToken.priceUsd != null && (
                  <span className="text-xs text-text-secondary font-mono">${formatPrice(selectedToken.priceUsd)}</span>
                )}
                {selectedToken.marketCapUsd != null && (
                  <span className="text-xs text-text-tertiary">MCap {formatMcap(selectedToken.marketCapUsd)}</span>
                )}
                {selectedToken.liquidityUsd != null && (
                  <span className="text-xs text-text-tertiary">Liq {formatMcap(selectedToken.liquidityUsd)}</span>
                )}
                <a
                  href={selectedToken.birdeyeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-tertiary hover:text-text-primary transition-colors-fast"
                  title="View on Birdeye"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <button onClick={closeModal} className="text-text-tertiary hover:text-text-primary text-lg leading-none">&times;</button>
            </div>
            {/* Body */}
            <div className="overflow-y-auto p-4">
              <h4 className="mb-2 text-xs font-medium text-text-secondary">
                Mentions ({mentions.length})
              </h4>
              {loadingMentions ? (
                <p className="text-xs text-text-tertiary py-4 text-center">Loading...</p>
              ) : mentions.length === 0 ? (
                <p className="text-xs text-text-tertiary py-4 text-center">No mentions found.</p>
              ) : (
                <div className="space-y-2">
                  {mentions.map((mention) => (
                    <div
                      key={mention.tweetId}
                      className="rounded-none border border-void-border bg-void-surface p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-text-primary">@{mention.accountHandle}</span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-xs font-medium ${CATEGORY_BADGE_COLORS[mention.accountCategory]}`}>
                          {MEMECOIN_CATEGORY_LABELS[mention.accountCategory]}
                        </span>
                        {mention.isVip && <Star className="h-3 w-3 fill-terminal-amber text-terminal-amber" />}
                        <span className="ml-auto text-xs text-text-tertiary">
                          {new Date(mention.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary line-clamp-3">{mention.tweetText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SourceBadge({ source }: { source: "twitter" | "manual" | null }) {
  if (!source) return <span className="text-xs text-text-tertiary">—</span>;

  if (source === "twitter") {
    return (
      <span className="inline-flex items-center rounded-full bg-void-muted border border-void-border px-1.5 py-0.5 text-xs font-medium text-text-secondary">
        Twitter
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-void-muted border border-void-border px-1.5 py-0.5 text-xs font-medium text-text-secondary">
      Manual
    </span>
  );
}

function formatPrice(n: number): string {
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6);
  if (n < 100) return n.toFixed(4);
  return n.toFixed(2);
}

function formatMcap(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
