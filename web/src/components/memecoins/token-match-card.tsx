"use client";

/**
 * TokenMatchCard — Displays a matched token from a tweet.
 * Shows symbol, price, mcap, liquidity, and DexScreener link.
 */

import type { MemecoinTokenMatch } from "@/lib/types";

interface TokenMatchCardProps {
  match: MemecoinTokenMatch;
}

export function TokenMatchCard({ match }: TokenMatchCardProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1.5">
      <span className="font-mono text-xs font-semibold text-primary">
        ${match.tokenSymbol}
      </span>

      {match.priceUsd != null && (
        <span className="text-xs text-secondary">
          ${formatPrice(match.priceUsd)}
        </span>
      )}

      {match.marketCapUsd != null && (
        <span className="text-xs text-muted">
          MC: {formatMcap(match.marketCapUsd)}
        </span>
      )}

      {match.liquidityUsd != null && (
        <span className="text-xs text-muted">
          Liq: {formatMcap(match.liquidityUsd)}
        </span>
      )}

      <span
        className={`rounded px-1 py-0.5 text-[9px] font-medium ${
          match.source === "llm"
            ? "bg-[var(--accent-purple-subtle)] text-[var(--accent-purple)]"
            : "bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)]"
        }`}
      >
        {match.source === "llm" ? "LLM" : "KEYWORD"}
      </span>

      {match.dexscreenerUrl && (
        <a
          href={match.dexscreenerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
        >
          DEX
        </a>
      )}
    </div>
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
