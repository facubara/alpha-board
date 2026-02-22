/**
 * TrendingTokens — Ranked table of most-mentioned tokens in the last 24h.
 * Links to Birdeye for each token. Deduped by highest-liquidity mint per symbol.
 */

import { ExternalLink } from "lucide-react";
import type { TrendingToken } from "@/lib/types";

interface TrendingTokensProps {
  tokens: TrendingToken[];
}

export function TrendingTokens({ tokens }: TrendingTokensProps) {
  if (tokens.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-muted">
        No trending tokens in the last 24 hours.
      </div>
    );
  }

  return (
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
              className="border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
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
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
