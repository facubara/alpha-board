"use client";

import { Star } from "lucide-react";
import type { MemecoinTwitterAccount, AccountCallHistoryItem, MemecoinCategory } from "@/lib/types";
import { MEMECOIN_CATEGORY_LABELS } from "@/lib/types";

const CATEGORY_BADGE_COLORS: Record<MemecoinCategory, string> = {
  caller: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  influencer: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  degen: "bg-red-500/10 text-red-400 border-red-500/20",
  news: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

function formatFollowers(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatMcap(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

interface MemecoinCallHistoryModalProps {
  account: MemecoinTwitterAccount;
  callHistory: AccountCallHistoryItem[];
  loadingCalls: boolean;
  onClose: () => void;
}

export function MemecoinCallHistoryModal({
  account,
  callHistory,
  loadingCalls,
  onClose,
}: MemecoinCallHistoryModalProps) {
  return (
    <div
      role="dialog"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary">@{account.handle}</span>
            <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE_COLORS[account.category]}`}>
              {MEMECOIN_CATEGORY_LABELS[account.category]}
            </span>
            {account.isVip && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
            {account.followersCount != null && (
              <span className="text-xs text-muted">{formatFollowers(account.followersCount)} followers</span>
            )}
            {account.tweetCount != null && (
              <span className="text-xs text-muted">{account.tweetCount} tweets</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-primary text-lg leading-none">&times;</button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto p-4">
          <h4 className="mb-2 text-xs font-medium text-secondary">Call History</h4>
          {loadingCalls ? (
            <p className="text-xs text-muted py-4 text-center">Loading...</p>
          ) : callHistory.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">No token calls found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-default)] text-muted">
                    <th className="px-2 py-1.5 text-left font-medium">Token</th>
                    <th className="px-2 py-1.5 text-left font-medium">First Mentioned</th>
                    <th className="px-2 py-1.5 text-right font-medium">Mentions</th>
                    <th className="px-2 py-1.5 text-right font-medium">Match MCap</th>
                    <th className="px-2 py-1.5 text-right font-medium">ATH MCap</th>
                    <th className="px-2 py-1.5 text-right font-medium">Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {callHistory.map((item) => {
                    const mult = item.athMcap && item.matchTimeMcap && item.matchTimeMcap > 0
                      ? item.athMcap / item.matchTimeMcap
                      : null;
                    return (
                      <tr key={item.tokenMint} className="border-b border-[var(--border-subtle)]">
                        <td className="px-2 py-1.5">
                          <a
                            href={`https://birdeye.so/token/${item.tokenMint}?chain=solana`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-semibold text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            ${item.tokenSymbol}
                          </a>
                          {item.tokenName && <span className="ml-1 text-muted">{item.tokenName}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-secondary">{new Date(item.firstMentionedAt).toLocaleDateString()}</td>
                        <td className="px-2 py-1.5 text-right text-secondary">{item.mentionCount}</td>
                        <td className="px-2 py-1.5 text-right text-secondary font-mono">
                          {item.matchTimeMcap != null ? formatMcap(item.matchTimeMcap) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right text-secondary font-mono">
                          {item.athMcap != null ? formatMcap(item.athMcap) : "—"}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-mono font-semibold ${
                          mult == null ? "text-muted" : mult >= 2 ? "text-bullish" : mult >= 1 ? "text-neutral-signal" : "text-bearish"
                        }`}>
                          {mult != null ? `${mult.toFixed(1)}x` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
