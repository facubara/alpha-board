"use client";

/**
 * TrendingTokens — Enhanced ranked table with holder counts, volume,
 * sparklines, source badges, per-token refresh intervals, and manual add.
 * Clickable rows open a modal showing which accounts mentioned the token.
 */

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, Star, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EnrichedToken, TokenMention, MemecoinCategory } from "@/lib/types";
import { MEMECOIN_CATEGORY_LABELS, TRACKER_REFRESH_INTERVALS } from "@/lib/types";
import { HolderSparkline } from "./holder-sparkline";

const CATEGORY_BADGE_COLORS: Record<MemecoinCategory, string> = {
  caller: "bg-[var(--accent-orange-subtle)] text-[var(--accent-orange)] border-[var(--accent-orange-subtle)]",
  influencer: "bg-[var(--accent-purple-subtle)] text-[var(--accent-purple)] border-[var(--accent-purple-subtle)]",
  degen: "bg-[var(--bearish-subtle)] text-bearish border-[var(--bearish-subtle)]",
  news: "bg-[var(--accent-yellow-subtle)] text-[var(--accent-yellow)] border-[var(--accent-yellow-subtle)]",
};

interface TrendingTokensProps {
  tokens: EnrichedToken[];
}

export function TrendingTokens({ tokens }: TrendingTokensProps) {
  const router = useRouter();
  const [selectedToken, setSelectedToken] = useState<EnrichedToken | null>(null);
  const [mentions, setMentions] = useState<TokenMention[]>([]);
  const [loadingMentions, setLoadingMentions] = useState(false);

  // Add token form
  const [mintInput, setMintInput] = useState("");
  const [intervalInput, setIntervalInput] = useState(15);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

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
        router.refresh();
      }
    } catch {
      setAddError("Network error");
    }
    setAdding(false);
  }

  async function handleDelete(mint: string) {
    try {
      const res = await fetch(`/api/memecoins/tracker/${encodeURIComponent(mint)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // Silently fail
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
        className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2"
      >
        <Plus className="h-4 w-4 text-muted shrink-0" />
        <input
          type="text"
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          placeholder="Paste mint address to track..."
          className="flex-1 bg-transparent text-xs text-primary placeholder:text-muted outline-none min-w-0"
        />
        <select
          value={intervalInput}
          onChange={(e) => setIntervalInput(Number(e.target.value))}
          className="rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-xs text-secondary outline-none"
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
          className="rounded bg-[var(--primary)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {adding ? "..." : "Add"}
        </button>
        {addError && (
          <span className="text-xs text-bearish shrink-0">{addError}</span>
        )}
      </form>

      {/* Token Table */}
      {tokens.length === 0 ? (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-muted">
          No tokens tracked yet. Add a mint address above or wait for Twitter discovery.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--border-default)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted w-8">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted">Token</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted">Mentions</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted">Price</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted">Market Cap</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted">Holders</th>
                <th className="hidden md:table-cell px-3 py-2 text-right text-xs font-medium text-muted">Vol 24h</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted">Source</th>
                <th className="hidden md:table-cell px-3 py-2 text-center text-xs font-medium text-muted">Interval</th>
                <th className="px-3 py-2 text-xs font-medium text-muted w-16"></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token, i) => (
                <tr
                  key={token.tokenMint}
                  onClick={() => handleTokenClick(token)}
                  className={`border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] ${token.mentionCount > 0 ? "cursor-pointer" : ""}`}
                >
                  <td className="px-3 py-2 text-muted">
                    {token.rank > 0 ? token.rank : i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs font-semibold text-primary">
                      ${token.tokenSymbol}
                    </span>
                    {token.tokenName && (
                      <span className="ml-2 text-xs text-muted">
                        {token.tokenName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {token.mentionCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                        {token.mentionCount}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-secondary font-mono text-xs">
                    {token.priceUsd != null ? `$${formatPrice(token.priceUsd)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-secondary text-xs">
                    {token.marketCapUsd != null ? formatMcap(token.marketCapUsd) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {token.latestHolders != null ? (
                        <span className="text-xs text-secondary tabular-nums">
                          {token.latestHolders.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                      <HolderSparkline snapshots={token.snapshots} />
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-2 text-right text-secondary text-xs">
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
                        className="rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1 py-0.5 text-xs text-secondary outline-none"
                      >
                        {TRACKER_REFRESH_INTERVALS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <a
                        href={token.birdeyeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted hover:text-primary transition-colors-fast"
                        title="View on Birdeye"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {token.source === "manual" && (
                        <button
                          onClick={() => handleDelete(token.tokenMint)}
                          className="text-muted hover:text-bearish transition-colors-fast"
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
          <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] shadow-lg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-primary">${selectedToken.tokenSymbol}</span>
                {selectedToken.priceUsd != null && (
                  <span className="text-xs text-secondary font-mono">${formatPrice(selectedToken.priceUsd)}</span>
                )}
                {selectedToken.marketCapUsd != null && (
                  <span className="text-xs text-muted">MCap {formatMcap(selectedToken.marketCapUsd)}</span>
                )}
                {selectedToken.liquidityUsd != null && (
                  <span className="text-xs text-muted">Liq {formatMcap(selectedToken.liquidityUsd)}</span>
                )}
                <a
                  href={selectedToken.birdeyeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-primary transition-colors-fast"
                  title="View on Birdeye"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <button onClick={closeModal} className="text-muted hover:text-primary text-lg leading-none">&times;</button>
            </div>
            {/* Body */}
            <div className="overflow-y-auto p-4">
              <h4 className="mb-2 text-xs font-medium text-secondary">
                Mentions ({mentions.length})
              </h4>
              {loadingMentions ? (
                <p className="text-xs text-muted py-4 text-center">Loading...</p>
              ) : mentions.length === 0 ? (
                <p className="text-xs text-muted py-4 text-center">No mentions found.</p>
              ) : (
                <div className="space-y-2">
                  {mentions.map((mention) => (
                    <div
                      key={mention.tweetId}
                      className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-primary">@{mention.accountHandle}</span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-xs font-medium ${CATEGORY_BADGE_COLORS[mention.accountCategory]}`}>
                          {MEMECOIN_CATEGORY_LABELS[mention.accountCategory]}
                        </span>
                        {mention.isVip && <Star className="h-3 w-3 fill-[var(--accent-yellow)] text-[var(--accent-yellow)]" />}
                        <span className="ml-auto text-xs text-muted">
                          {new Date(mention.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-secondary line-clamp-3">{mention.tweetText}</p>
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
  if (!source) return <span className="text-xs text-muted">—</span>;

  if (source === "twitter") {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--accent-blue-subtle)] border border-[var(--accent-blue-subtle)] px-1.5 py-0.5 text-xs font-medium text-[var(--accent-blue)]">
        Twitter
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-[var(--accent-zinc-subtle)] border border-[var(--accent-zinc-subtle)] px-1.5 py-0.5 text-xs font-medium text-secondary">
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
