"use client";

/**
 * TokenAnalyzer — Analyze a Solana token CA to find early buyers.
 * Input: paste a CA + set N buyers.
 * Output: progress bar, wallet results table with rich on-chain data.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type {
  TokenAnalysis,
  AnalyzedWalletResult,
  AnalysisStatus,
} from "@/lib/types";

interface TokenAnalyzerProps {
  initialAnalyses: TokenAnalysis[];
}

export function TokenAnalyzer({ initialAnalyses }: TokenAnalyzerProps) {
  const [mintAddress, setMintAddress] = useState("");
  const [numBuyers, setNumBuyers] = useState(50);
  const [analyses, setAnalyses] = useState<TokenAnalysis[]>(initialAnalyses);
  const [activeAnalysis, setActiveAnalysis] = useState<TokenAnalysis | null>(null);
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll active analysis for progress
  useEffect(() => {
    if (!activeAnalysis || !["pending", "running"].includes(activeAnalysis.status)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/memecoins/analyze/${activeAnalysis.id}`);
        if (res.ok) {
          const data: TokenAnalysis = await res.json();
          setActiveAnalysis(data);
          // Update in list too
          setAnalyses((prev) =>
            prev.map((a) => (a.id === data.id ? { ...a, ...data } : a))
          );
          if (!["pending", "running"].includes(data.status)) {
            clearInterval(interval);
          }
        }
      } catch {
        // silent
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeAnalysis?.id, activeAnalysis?.status]);

  async function startAnalysis() {
    const mint = mintAddress.trim();
    if (!mint) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/memecoins/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mintAddress: mint, numBuyers }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || data.detail || "Failed to start analysis");
        return;
      }

      const { analysisId } = await res.json();

      // Create a temporary analysis entry
      const newAnalysis: TokenAnalysis = {
        id: analysisId,
        mintAddress: mint,
        tokenSymbol: null,
        tokenName: null,
        marketCapUsd: null,
        requestedBuyers: numBuyers,
        foundBuyers: 0,
        status: "pending",
        errorMessage: null,
        requestedAt: new Date().toISOString(),
        completedAt: null,
      };

      setAnalyses((prev) => [newAnalysis, ...prev]);
      setActiveAnalysis(newAnalysis);
      setMintAddress("");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalysis(id: number) {
    try {
      const res = await fetch(`/api/memecoins/analyze/${id}`);
      if (res.ok) {
        const data: TokenAnalysis = await res.json();
        setActiveAnalysis(data);
      }
    } catch {
      // silent
    }
  }

  async function resumeAnalysis(id: number) {
    try {
      await fetch(`/api/memecoins/analyze/${id}/resume`, { method: "POST" });
      await loadAnalysis(id);
    } catch {
      // silent
    }
  }

  const progressPct =
    activeAnalysis && activeAnalysis.requestedBuyers > 0
      ? Math.min(
          (activeAnalysis.foundBuyers / activeAnalysis.requestedBuyers) * 100,
          100
        )
      : 0;

  const statusColor: Record<AnalysisStatus, string> = {
    pending: "text-[var(--accent-yellow)]",
    running: "text-[var(--accent-blue)]",
    paused: "text-[var(--accent-orange)]",
    completed: "text-bullish",
    failed: "text-bearish",
  };

  return (
    <div className="space-y-4">
      {/* Input form */}
      <div className="rounded-lg border border-primary/10 bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-secondary">
              Token CA (Solana mint address)
            </label>
            <input
              type="text"
              value={mintAddress}
              onChange={(e) => setMintAddress(e.target.value)}
              placeholder="Paste Solana token address..."
              className="w-full rounded-md border border-primary/10 bg-background px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs text-secondary">Buyers</label>
            <input
              type="number"
              value={numBuyers}
              onChange={(e) =>
                setNumBuyers(Math.min(Math.max(Number(e.target.value) || 1, 1), 500))
              }
              min={1}
              max={500}
              className="w-full rounded-md border border-primary/10 bg-background px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none"
            />
          </div>
          <button
            onClick={startAnalysis}
            disabled={loading || !mintAddress.trim()}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Analyze
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-bearish">{error}</p>}
      </div>

      {/* Active analysis progress */}
      {activeAnalysis && (
        <div className="rounded-lg border border-primary/10 bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-primary">
                {activeAnalysis.tokenSymbol || activeAnalysis.mintAddress.slice(0, 8) + "..."}
              </span>
              {activeAnalysis.tokenName && (
                <span className="ml-2 text-xs text-secondary">
                  {activeAnalysis.tokenName}
                </span>
              )}
              {activeAnalysis.marketCapUsd && (
                <span className="ml-2 text-xs text-muted">
                  MCap: ${activeAnalysis.marketCapUsd >= 1_000_000
                    ? `${(activeAnalysis.marketCapUsd / 1_000_000).toFixed(1)}M`
                    : `${(activeAnalysis.marketCapUsd / 1_000).toFixed(0)}K`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${statusColor[activeAnalysis.status]}`}>
                {activeAnalysis.status.toUpperCase()}
              </span>
              {(activeAnalysis.status === "paused" || activeAnalysis.status === "failed") && (
                <button
                  onClick={() => resumeAnalysis(activeAnalysis.id)}
                  className="rounded p-1 text-secondary hover:text-primary"
                  title="Resume"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary/5">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>
                {activeAnalysis.foundBuyers} / {activeAnalysis.requestedBuyers} wallets
              </span>
              <span>{progressPct.toFixed(0)}%</span>
            </div>
          </div>

          {activeAnalysis.errorMessage && (
            <p className="mt-1 text-xs text-bearish">{activeAnalysis.errorMessage}</p>
          )}

          {/* Results table */}
          {activeAnalysis.wallets && activeAnalysis.wallets.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-primary/10 text-left text-muted">
                    <th className="pb-2 pr-3">#</th>
                    <th className="pb-2 pr-3">Wallet</th>
                    <th className="pb-2 pr-3 text-right">SOL</th>
                    <th className="pb-2 pr-3 text-right">USDC</th>
                    <th className="pb-2 pr-3 text-right">Txns</th>
                    <th className="pb-2 pr-3 text-right">Tokens</th>
                    <th className="pb-2 pr-3">Tags</th>
                    <th className="pb-2 pr-3">Past Hits</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {activeAnalysis.wallets.map((w) => (
                    <WalletRow
                      key={w.address}
                      wallet={w}
                      expanded={expandedWallet === w.address}
                      onToggle={() =>
                        setExpandedWallet(
                          expandedWallet === w.address ? null : w.address
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recent analyses list */}
      {analyses.length > 0 && (
        <div className="rounded-lg border border-primary/10 bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-primary">Recent Analyses</h3>
          <div className="space-y-2">
            {analyses.map((a) => (
              <button
                key={a.id}
                onClick={() => loadAnalysis(a.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-primary/5 ${
                  activeAnalysis?.id === a.id ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-primary">
                    {a.tokenSymbol || a.mintAddress.slice(0, 8) + "..."}
                  </span>
                  <span className={statusColor[a.status]}>
                    {a.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted">
                  <span>
                    {a.foundBuyers}/{a.requestedBuyers}
                  </span>
                  <span>{new Date(a.requestedAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WalletRow({
  wallet,
  expanded,
  onToggle,
}: {
  wallet: AnalyzedWalletResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const addrShort = wallet.address.slice(0, 4) + "..." + wallet.address.slice(-4);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-primary/5 hover:bg-primary/5"
        onClick={onToggle}
      >
        <td className="py-2 pr-3 text-muted">{wallet.entryRank}</td>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted" />
            )}
            <code className="font-mono text-primary">{addrShort}</code>
            <a
              href={`https://solscan.io/account/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted hover:text-accent"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </td>
        <td className="py-2 pr-3 text-right font-mono text-primary">
          {wallet.solBalance != null ? wallet.solBalance.toFixed(2) : "-"}
        </td>
        <td className="py-2 pr-3 text-right font-mono text-primary">
          {wallet.usdcBalance != null ? wallet.usdcBalance.toFixed(0) : "-"}
        </td>
        <td className="py-2 pr-3 text-right text-secondary">
          {wallet.totalTxCount?.toLocaleString() ?? "-"}
        </td>
        <td className="py-2 pr-3 text-right text-secondary">
          {wallet.tokensTraded ?? "-"}
        </td>
        <td className="py-2 pr-3">
          <div className="flex flex-wrap gap-1">
            {wallet.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        </td>
        <td className="py-2 pr-3 text-secondary">
          {wallet.tokenEntries.length > 0 ? wallet.tokenEntries.length : "-"}
        </td>
        <td className="py-2">
          {wallet.amountSol != null && (
            <span className="text-muted">{wallet.amountSol.toFixed(2)} SOL</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-primary/5 px-4 py-3">
            <div className="space-y-3">
              {/* Holdings */}
              {wallet.currentHoldings.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted">
                    Current Holdings
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {wallet.currentHoldings.slice(0, 10).map((h) => (
                      <span
                        key={h.mint}
                        className="rounded border border-primary/10 px-2 py-0.5 text-xs text-secondary"
                      >
                        {h.symbol || h.mint.slice(0, 6)}:{" "}
                        {h.value_usd ? `$${h.value_usd.toFixed(0)}` : h.amount.toFixed(0)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Past token entries */}
              {wallet.tokenEntries.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted">
                    Past Early Entries
                  </p>
                  <div className="space-y-1">
                    {wallet.tokenEntries.map((e) => (
                      <div
                        key={e.mintAddress}
                        className="flex items-center gap-3 text-[11px]"
                      >
                        <span className="font-medium text-primary">
                          {e.tokenSymbol || e.mintAddress.slice(0, 8)}
                        </span>
                        <span className="text-muted">Rank #{e.entryRank}</span>
                        {e.amountSol && (
                          <span className="text-secondary">
                            {e.amountSol.toFixed(2)} SOL
                          </span>
                        )}
                        {e.tokenPeakMcap && (
                          <span className="text-bullish">
                            Peak: $
                            {e.tokenPeakMcap >= 1_000_000
                              ? `${(e.tokenPeakMcap / 1_000_000).toFixed(1)}M`
                              : `${(e.tokenPeakMcap / 1_000).toFixed(0)}K`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full address */}
              <div className="text-xs text-muted">
                <code>{wallet.address}</code>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
