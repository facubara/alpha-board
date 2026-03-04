"use client";

import { Star } from "lucide-react";
import type { MemecoinTwitterAccount, AccountCallHistoryItem, MemecoinCategory } from "@/lib/types";
import { MEMECOIN_CATEGORY_LABELS } from "@/lib/types";

const CATEGORY_BADGE_COLORS: Record<MemecoinCategory, string> = {
  caller: "bg-terminal-amber-muted text-terminal-amber border-terminal-amber/20",
  influencer: "bg-terminal-amber-muted text-terminal-amber border-terminal-amber/20",
  degen: "bg-terminal-amber-muted text-data-loss border-void-border",
  news: "bg-terminal-amber-muted text-terminal-amber border-terminal-amber/20",
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
      <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-none border border-void-border bg-void flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-void-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">@{account.handle}</span>
            <span className={`rounded-full border px-1.5 py-0.5 text-xs font-medium ${CATEGORY_BADGE_COLORS[account.category]}`}>
              {MEMECOIN_CATEGORY_LABELS[account.category]}
            </span>
            {account.isVip && <Star className="h-3 w-3 fill-terminal-amber text-terminal-amber" />}
            {account.followersCount != null && (
              <span className="text-xs text-text-tertiary">{formatFollowers(account.followersCount)} followers</span>
            )}
            {account.tweetCount != null && (
              <span className="text-xs text-text-tertiary">{account.tweetCount} tweets</span>
            )}
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg leading-none">&times;</button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto p-4">
          <h4 className="mb-2 text-xs font-medium text-text-secondary">Call History</h4>
          {loadingCalls ? (
            <p className="text-xs text-text-tertiary py-4 text-center">Loading...</p>
          ) : callHistory.length === 0 ? (
            <p className="text-xs text-text-tertiary py-4 text-center">No token calls found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-void-border text-text-tertiary">
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
                      <tr key={item.tokenMint} className="border-b border-void-border">
                        <td className="px-2 py-1.5">
                          <a
                            href={`https://birdeye.so/token/${item.tokenMint}?chain=solana`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-semibold text-text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            ${item.tokenSymbol}
                          </a>
                          {item.tokenName && <span className="ml-1 text-text-tertiary">{item.tokenName}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-text-secondary">{new Date(item.firstMentionedAt).toLocaleDateString()}</td>
                        <td className="px-2 py-1.5 text-right text-text-secondary">{item.mentionCount}</td>
                        <td className="px-2 py-1.5 text-right text-text-secondary font-mono">
                          {item.matchTimeMcap != null ? formatMcap(item.matchTimeMcap) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right text-text-secondary font-mono">
                          {item.athMcap != null ? formatMcap(item.athMcap) : "—"}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-mono font-semibold ${
                          mult == null ? "text-text-tertiary" : mult >= 2 ? "text-data-profit" : mult >= 1 ? "text-terminal-amber" : "text-data-loss"
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
