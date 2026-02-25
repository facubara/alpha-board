"use client";

/**
 * MemecoinAccountManager — CRUD for memecoin Twitter accounts.
 * Collapsible sorted table with VIP toggle, follower counts, and bios.
 */

import { useState, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Star, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { MemecoinTwitterAccount, MemecoinCategory, AccountCallHistoryItem } from "@/lib/types";
import { MEMECOIN_CATEGORIES, MEMECOIN_CATEGORY_LABELS } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CATEGORY_BADGE_COLORS: Record<MemecoinCategory, string> = {
  caller: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  influencer: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  degen: "bg-red-500/10 text-red-400 border-red-500/20",
  news: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

type SortField = "handle" | "category" | "followers" | "tweets" | "bio";
type SortDirection = "asc" | "desc";

interface MemecoinAccountManagerProps {
  initialAccounts: MemecoinTwitterAccount[];
}

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

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return null;
  return sortDirection === "asc" ? (
    <ChevronUp className="inline h-3 w-3" />
  ) : (
    <ChevronDown className="inline h-3 w-3" />
  );
}

export function MemecoinAccountManager({
  initialAccounts,
}: MemecoinAccountManagerProps) {
  const router = useRouter();
  const { requireAuth } = useAuth();
  const [accounts, setAccounts] =
    useState<MemecoinTwitterAccount[]>(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState<MemecoinCategory>("caller");
  const [isVip, setIsVip] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<MemecoinTwitterAccount | null>(null);
  const [callHistory, setCallHistory] = useState<AccountCallHistoryItem[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [sortField, setSortField] = useState<SortField>("followers");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const sorted = useMemo(() => {
    const list = [...accounts];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "handle":
          cmp = a.handle.localeCompare(b.handle);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "followers":
          cmp = (a.followersCount ?? -1) - (b.followersCount ?? -1);
          break;
        case "tweets":
          cmp = (a.tweetCount ?? 0) - (b.tweetCount ?? 0);
          break;
        case "bio":
          cmp = (a.bio ?? "").localeCompare(b.bio ?? "");
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [accounts, sortField, sortDirection]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = useMemo(
    () => sorted.slice(page * pageSize, (page + 1) * pageSize),
    [sorted, page, pageSize]
  );

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "handle" || field === "category" ? "asc" : "desc");
    }
    setPage(0);
  }

  async function doAdd() {
    if (!handle.trim()) return;
    setError(null);

    const resolvedDisplayName =
      displayName.trim() || handle.replace(/^@/, "").trim();

    try {
      const res = await fetch("/api/memecoins/twitter/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          displayName: resolvedDisplayName,
          category,
          isVip,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add account");
        return;
      }

      const newAccount = await res.json();
      setAccounts((prev) => [{ ...newAccount, tweetCount: 0 }, ...prev]);
      setHandle("");
      setDisplayName("");
      setIsVip(false);
      setShowForm(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Failed to add account");
    }
  }

  function handleAdd() {
    requireAuth(() => doAdd());
  }

  async function doDelete(id: number) {
    try {
      const res = await fetch("/api/memecoins/twitter/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        startTransition(() => router.refresh());
      }
    } catch {
      // silent
    }
  }

  function handleDelete(id: number) {
    requireAuth(() => doDelete(id));
  }

  async function doToggleVip(id: number) {
    try {
      const res = await fetch(`/api/memecoins/twitter/accounts/${id}/vip`, {
        method: "PATCH",
      });

      if (res.ok) {
        const data = await res.json();
        setAccounts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isVip: data.isVip } : a))
        );
      }
    } catch {
      // silent
    }
  }

  function handleToggleVip(id: number) {
    requireAuth(() => doToggleVip(id));
  }

  const handleAccountClick = useCallback(async (account: MemecoinTwitterAccount) => {
    setSelectedAccount(account);
    setLoadingCalls(true);
    try {
      const res = await fetch(`/api/memecoins/twitter/accounts/${account.id}/calls`);
      if (res.ok) {
        setCallHistory(await res.json());
      }
      setLoadingCalls(false);
    } catch {
      setLoadingCalls(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-secondary transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Tracked Accounts ({accounts.length})
        </button>
        <button
          onClick={() => { setShowForm((v) => !v); if (!expanded) setExpanded(true); }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-secondary transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Add Account
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="@handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none"
            />
            <input
              type="text"
              placeholder="Display Name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MemecoinCategory)}
              className="rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-sm text-primary focus:border-[var(--primary)] focus:outline-none"
            >
              {MEMECOIN_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {MEMECOIN_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={isVip}
                onChange={(e) => setIsVip(e.target.checked)}
                className="rounded"
              />
              VIP
            </label>
            <button
              onClick={handleAdd}
              disabled={!handle.trim()}
              className="rounded bg-[var(--primary)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* Account table (collapsible) */}
      {expanded && (
        accounts.length === 0 ? (
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-muted">
            No memecoin accounts tracked yet.
          </div>
        ) : (
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-default)]">
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary"
                    onClick={() => handleSort("handle")}
                  >
                    Handle <SortIcon field="handle" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary"
                    onClick={() => handleSort("category")}
                  >
                    Category <SortIcon field="category" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary text-right"
                    onClick={() => handleSort("followers")}
                  >
                    Followers <SortIcon field="followers" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary text-right"
                    onClick={() => handleSort("tweets")}
                  >
                    Tweets <SortIcon field="tweets" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary"
                    onClick={() => handleSort("bio")}
                  >
                    Bio <SortIcon field="bio" sortField={sortField} sortDirection={sortDirection} />
                  </TableHead>
                  <TableHead className="text-xs text-muted w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((account) => (
                  <TableRow
                    key={account.id}
                    className="group cursor-pointer border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]"
                    onClick={() => handleAccountClick(account)}
                  >
                    <TableCell className="text-sm text-primary font-medium">
                      <span className="flex items-center gap-1.5">
                        @{account.handle}
                        {account.isVip && (
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                          CATEGORY_BADGE_COLORS[account.category]
                        }`}
                      >
                        {MEMECOIN_CATEGORY_LABELS[account.category]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-secondary font-mono">
                      {formatFollowers(account.followersCount)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-secondary">
                      {account.tweetCount ?? 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted max-w-[200px] truncate" title={account.bio ?? ""}>
                      {account.bio ? (account.bio.length > 60 ? account.bio.slice(0, 60) + "..." : account.bio) : "—"}
                    </TableCell>
                    <TableCell>
                      <span role="group" className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleVip(account.id)}
                          className={`transition-colors ${
                            account.isVip
                              ? "text-yellow-400 hover:text-yellow-300"
                              : "text-muted opacity-0 group-hover:opacity-100 hover:text-yellow-400"
                          }`}
                          title={account.isVip ? "Remove VIP" : "Set as VIP"}
                        >
                          <Star className="h-3 w-3" />
                        </button>
                        {deletingId === account.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => { handleDelete(account.id); setDeletingId(null); }}
                              className="font-medium text-red-400 hover:text-red-300"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="font-medium text-muted hover:text-primary"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeletingId(account.id)}
                            className="text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                            title="Remove account"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-[var(--border-default)] px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span>Show</span>
                {[10, 25, 50].map((size) => (
                  <button
                    key={size}
                    onClick={() => { setPageSize(size); setPage(0); }}
                    className={`rounded px-1.5 py-0.5 ${pageSize === size ? "bg-[var(--bg-elevated)] text-primary font-medium" : "hover:text-primary"}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}</span>
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded p-0.5 hover:text-primary disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded p-0.5 hover:text-primary disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Account Call History Modal */}
      {selectedAccount && (
        <div
          role="dialog"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedAccount(null); }}
          onKeyDown={(e) => { if (e.key === "Escape") setSelectedAccount(null); }}
        >
          <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] shadow-lg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">@{selectedAccount.handle}</span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE_COLORS[selectedAccount.category]}`}>
                  {MEMECOIN_CATEGORY_LABELS[selectedAccount.category]}
                </span>
                {selectedAccount.isVip && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                {selectedAccount.followersCount != null && (
                  <span className="text-xs text-muted">{formatFollowers(selectedAccount.followersCount)} followers</span>
                )}
                {selectedAccount.tweetCount != null && (
                  <span className="text-xs text-muted">{selectedAccount.tweetCount} tweets</span>
                )}
              </div>
              <button onClick={() => setSelectedAccount(null)} className="text-muted hover:text-primary text-lg leading-none">&times;</button>
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
      )}
    </div>
  );
}
