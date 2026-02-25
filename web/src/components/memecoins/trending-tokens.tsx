"use client";

/**
 * TrendingTokens — Ranked table of most-mentioned tokens in the last 24h.
 * Clickable rows open a modal showing which accounts mentioned the token.
 */

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, Star } from "lucide-react";
import type { TrendingToken, TokenMention, MemecoinCategory } from "@/lib/types";
import { MEMECOIN_CATEGORY_LABELS } from "@/lib/types";

const CATEGORY_BADGE_COLORS: Record<MemecoinCategory, string> = {
  caller: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  influencer: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  degen: "bg-red-500/10 text-red-400 border-red-500/20",
  news: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

interface TrendingTokensProps {
  tokens: TrendingToken[];
}

export function TrendingTokens({ tokens }: TrendingTokensProps) {
  const [selectedToken, setSelectedToken] = useState<TrendingToken | null>(null);
  const [mentions, setMentions] = useState<TokenMention[]>([]);
  const [loadingMentions, setLoadingMentions] = useState(false);

  const closeModal = useCallback(() => setSelectedToken(null), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeModal]);

  async function handleTokenClick(token: TrendingToken) {
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

  if (tokens.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-muted">
        No trending tokens in the last 24 hours.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-[var(--border-default)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">Token</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted">Mentions</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted">Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted">Market Cap</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted">Liquidity</th>
              <th className="px-3 py-2 text-xs font-medium text-muted w-8"></th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr
                key={token.tokenMint}
                onClick={() => handleTokenClick(token)}
                className="cursor-pointer border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
              >
                <td className="px-3 py-2 text-muted">{token.rank}</td>
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
                  <span className="inline-flex items-center rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                    {token.mentionCount}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-secondary font-mono text-xs">
                  {token.priceUsd != null ? `$${formatPrice(token.priceUsd)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right text-secondary text-xs">
                  {token.marketCapUsd != null ? formatMcap(token.marketCapUsd) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-secondary text-xs">
                  {token.liquidityUsd != null ? formatMcap(token.liquidityUsd) : "—"}
                </td>
                <td className="px-3 py-2">
                  <a
                    href={token.birdeyeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted hover:text-primary transition-colors-fast"
                    title="View on Birdeye"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE_COLORS[mention.accountCategory]}`}>
                          {MEMECOIN_CATEGORY_LABELS[mention.accountCategory]}
                        </span>
                        {mention.isVip && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                        <span className="ml-auto text-[10px] text-muted">
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
