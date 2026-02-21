"use client";

/**
 * WalletLeaderboard — Table of cross-referenced smart wallets.
 * Shows score, hit count, win rate, and expandable token summaries.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { WatchWallet } from "@/lib/types";

interface WalletLeaderboardProps {
  initialWallets: WatchWallet[];
}

export function WalletLeaderboard({ initialWallets }: WalletLeaderboardProps) {
  const router = useRouter();
  const { requireAuth } = useAuth();
  const [wallets, setWallets] = useState<WatchWallet[]>(initialWallets);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function doRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/memecoins/wallets/refresh", { method: "POST" });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    requireAuth(() => doRefresh());
  }

  async function doAdd() {
    if (!address.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/memecoins/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), label: label.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add wallet");
        return;
      }
      const newWallet = await res.json();
      setWallets((prev) => [newWallet, ...prev]);
      setAddress("");
      setLabel("");
      setShowAddForm(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Failed to add wallet");
    }
  }

  function handleAdd() {
    requireAuth(() => doAdd());
  }

  async function doDelete(addr: string) {
    try {
      const res = await fetch(`/api/memecoins/wallets?address=${addr}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWallets((prev) => prev.filter((w) => w.address !== addr));
        startTransition(() => router.refresh());
      }
    } catch {
      // silent
    }
  }

  function handleDelete(addr: string) {
    requireAuth(() => doDelete(addr));
  }

  function truncateAddress(addr: string): string {
    return addr.length > 10
      ? `${addr.slice(0, 4)}...${addr.slice(-4)}`
      : addr;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-secondary">
          {wallets.length} wallets tracked
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-secondary transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-secondary transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-primary"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Wallet address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none font-mono"
            />
            <input
              type="text"
              placeholder="Label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-40 rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={!address.trim()}
              className="rounded bg-[var(--primary)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* Table */}
      {wallets.length === 0 ? (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-muted">
          No wallets tracked yet. Add wallets or trigger a discovery refresh.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--border-default)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted w-8">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted">Address</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted">Label</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted">Score</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted">Hits</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted">Avg Rank</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted">Source</th>
                <th className="px-3 py-2 text-xs font-medium text-muted w-8"></th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((wallet, i) => (
                <>
                  <tr
                    key={wallet.id}
                    className="border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === wallet.id ? null : wallet.id)
                    }
                  >
                    <td className="px-3 py-2 text-muted">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-primary">
                        {truncateAddress(wallet.address)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-secondary">
                      {wallet.label || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-primary">
                      {wallet.score.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {wallet.hitCount}
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {wallet.avgEntryRank ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-medium text-secondary">
                        {wallet.source}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {expandedId === wallet.id ? (
                          <ChevronDown className="h-3 w-3 text-muted" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(wallet.address);
                          }}
                          className="text-muted hover:text-red-400"
                          title="Remove wallet"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === wallet.id && (
                    <tr key={`${wallet.id}-expanded`}>
                      <td
                        colSpan={8}
                        className="bg-[var(--bg-elevated)] px-4 py-3"
                      >
                        <div className="text-xs text-muted mb-2">
                          Early on {wallet.tokensSummary.length} tokens:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {wallet.tokensSummary.map((token, j) => (
                            <div
                              key={j}
                              className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1"
                            >
                              <span className="font-mono text-xs font-medium text-primary">
                                ${token.symbol}
                              </span>
                              <span className="ml-2 text-[10px] text-muted">
                                #{token.entry_rank}
                              </span>
                              {token.peak_mcap != null && (
                                <span className="ml-2 text-[10px] text-secondary">
                                  {formatMcap(token.peak_mcap)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-[10px] text-muted font-mono break-all">
                          {wallet.address}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatMcap(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
