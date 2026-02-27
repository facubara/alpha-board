"use client";

/**
 * TokenChecker — Cross-reference a new token's buyers against analyzed wallets.
 * Input: paste a CA.
 * Output: matching wallets with scores and past early entries.
 */

import { useState } from "react";
import {
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Loader2,
  Shield,
} from "lucide-react";
import type { CrossReferenceResult, CrossReferenceMatch } from "@/lib/types";

export function TokenChecker() {
  const [mintAddress, setMintAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrossReferenceResult | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  async function checkToken() {
    const mint = mintAddress.trim();
    if (!mint) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/memecoins/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mintAddress: mint }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || data.detail || "Check failed");
        return;
      }

      const data: CrossReferenceResult = await res.json();
      setResult(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function signalColor(score: number): string {
    if (score >= 60) return "text-bullish";
    if (score >= 30) return "text-[var(--accent-yellow)]";
    return "text-[var(--accent-orange)]";
  }

  function signalBg(score: number): string {
    if (score >= 60) return "bg-[var(--bullish-subtle)] border-[var(--bullish-subtle)]";
    if (score >= 30) return "bg-[var(--accent-yellow-subtle)] border-[var(--accent-yellow-subtle)]";
    return "bg-[var(--accent-orange-subtle)] border-[var(--accent-orange-subtle)]";
  }

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="rounded-lg border border-primary/10 bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-secondary">
              Token CA to check
            </label>
            <input
              type="text"
              value={mintAddress}
              onChange={(e) => setMintAddress(e.target.value)}
              placeholder="Paste Solana token address to cross-reference..."
              className="w-full rounded-md border border-primary/10 bg-background px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && checkToken()}
            />
          </div>
          <button
            onClick={checkToken}
            disabled={loading || !mintAddress.trim()}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            Check
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-bearish">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="rounded-lg border border-primary/10 bg-card p-4">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-primary">
                {result.tokenSymbol || result.mintAddress.slice(0, 8) + "..."}
              </span>
              {result.tokenName && (
                <span className="ml-2 text-xs text-secondary">
                  {result.tokenName}
                </span>
              )}
              {result.marketCapUsd && (
                <span className="ml-2 text-xs text-muted">
                  MCap: $
                  {result.marketCapUsd >= 1_000_000
                    ? `${(result.marketCapUsd / 1_000_000).toFixed(1)}M`
                    : `${(result.marketCapUsd / 1_000).toFixed(0)}K`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">
                {result.buyersScanned} buyers scanned
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  result.matches.length > 0
                    ? "bg-[var(--bullish-subtle)] text-bullish"
                    : "bg-primary/5 text-muted"
                }`}
              >
                {result.matches.length} match{result.matches.length !== 1 ? "es" : ""}
              </span>
            </div>
          </div>

          {/* Matches */}
          {result.matches.length === 0 ? (
            <p className="text-center text-xs text-muted py-4">
              No matches found in analyzed wallet database
            </p>
          ) : (
            <div className="space-y-2">
              {result.matches.map((match) => (
                <MatchRow
                  key={match.address}
                  match={match}
                  expanded={expandedMatch === match.address}
                  onToggle={() =>
                    setExpandedMatch(
                      expandedMatch === match.address ? null : match.address
                    )
                  }
                  signalColor={signalColor}
                  signalBg={signalBg}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  expanded,
  onToggle,
  signalColor,
  signalBg,
}: {
  match: CrossReferenceMatch;
  expanded: boolean;
  onToggle: () => void;
  signalColor: (score: number) => string;
  signalBg: (score: number) => string;
}) {
  const addrShort = match.address.slice(0, 4) + "..." + match.address.slice(-4);

  return (
    <div className={`rounded-md border ${signalBg(match.score)}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted" />
          )}
          <code className="font-mono text-xs text-primary">{addrShort}</code>
          <a
            href={`https://solscan.io/account/${match.address}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted hover:text-accent"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="flex gap-1">
            {match.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {match.entryRank && (
            <span className="text-muted">Rank #{match.entryRank}</span>
          )}
          <span className="text-secondary">
            {match.pastTokenCount} past hit{match.pastTokenCount !== 1 ? "s" : ""}
          </span>
          <span className={`font-medium ${signalColor(match.score)}`}>
            {match.score.toFixed(0)}/100
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-primary/10 px-4 py-3">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-muted">SOL Balance</p>
              <p className="font-mono text-primary">
                {match.solBalance != null ? match.solBalance.toFixed(2) : "-"}
              </p>
            </div>
            <div>
              <p className="text-muted">Transactions</p>
              <p className="text-primary">
                {match.totalTxCount?.toLocaleString() ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-muted">Score</p>
              <p className={`font-medium ${signalColor(match.score)}`}>
                {match.score.toFixed(1)}
              </p>
            </div>
          </div>

          {match.pastTokens.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium uppercase text-muted">
                Past Early Entries
              </p>
              <div className="space-y-1">
                {match.pastTokens.map((t) => (
                  <div
                    key={t.mintAddress}
                    className="flex items-center gap-3 text-[11px]"
                  >
                    <span className="font-medium text-primary">
                      {t.tokenSymbol || t.mintAddress.slice(0, 8)}
                    </span>
                    <span className="text-muted">Rank #{t.entryRank}</span>
                    {t.amountSol && (
                      <span className="text-secondary">
                        {t.amountSol.toFixed(2)} SOL
                      </span>
                    )}
                    {t.tokenPeakMcap && (
                      <span className="text-bullish">
                        Peak: $
                        {t.tokenPeakMcap >= 1_000_000
                          ? `${(t.tokenPeakMcap / 1_000_000).toFixed(1)}M`
                          : `${(t.tokenPeakMcap / 1_000).toFixed(0)}K`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 text-xs text-muted">
            <code>{match.address}</code>
          </div>
        </div>
      )}
    </div>
  );
}
