"use client";

/**
 * AccountManager — Add/remove tracked Twitter accounts.
 *
 * Collapsible sorted table view with follower counts and bios.
 */

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { TwitterAccount, TwitterAccountCategory } from "@/lib/types";
import { TWITTER_CATEGORIES, TWITTER_CATEGORY_LABELS } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CATEGORY_BADGE_COLORS: Record<TwitterAccountCategory, string> = {
  analyst: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  founder: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  news: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  degen: "bg-red-500/10 text-red-400 border-red-500/20",
  insider: "bg-green-500/10 text-green-400 border-green-500/20",
  protocol: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

type SortField = "handle" | "category" | "followers" | "tweets" | "bio";
type SortDirection = "asc" | "desc";

interface AccountManagerProps {
  initialAccounts: TwitterAccount[];
}

function formatFollowers(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AccountManager({ initialAccounts }: AccountManagerProps) {
  const router = useRouter();
  const { requireAuth } = useAuth();
  const [accounts, setAccounts] = useState<TwitterAccount[]>(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState<TwitterAccountCategory>("analyst");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="inline h-3 w-3" />
    ) : (
      <ChevronDown className="inline h-3 w-3" />
    );
  }

  async function doAdd() {
    if (!handle.trim()) return;
    setError(null);

    const resolvedDisplayName = displayName.trim() || handle.replace(/^@/, "").trim();

    try {
      const res = await fetch("/api/twitter/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, displayName: resolvedDisplayName, category }),
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
      const res = await fetch("/api/twitter/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        startTransition(() => router.refresh());
      }
    } catch {
      // Silently fail — account will remain visible
    }
  }

  function handleDelete(id: number) {
    requireAuth(() => doDelete(id));
  }

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
              onChange={(e) => setCategory(e.target.value as TwitterAccountCategory)}
              className="rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-sm text-primary focus:border-[var(--primary)] focus:outline-none"
            >
              {TWITTER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {TWITTER_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
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
            No accounts tracked yet. Add accounts to start ingesting tweets.
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
                    Handle <SortIcon field="handle" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary"
                    onClick={() => handleSort("category")}
                  >
                    Category <SortIcon field="category" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary text-right"
                    onClick={() => handleSort("followers")}
                  >
                    Followers <SortIcon field="followers" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary text-right"
                    onClick={() => handleSort("tweets")}
                  >
                    Tweets <SortIcon field="tweets" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary"
                    onClick={() => handleSort("bio")}
                  >
                    Bio <SortIcon field="bio" />
                  </TableHead>
                  <TableHead className="text-xs text-muted w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((account) => (
                  <TableRow key={account.id} className="group border-[var(--border-subtle)]">
                    <TableCell className="text-sm text-primary font-medium">
                      @{account.handle}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                          CATEGORY_BADGE_COLORS[account.category]
                        }`}
                      >
                        {TWITTER_CATEGORY_LABELS[account.category]}
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
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                        title="Remove account"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
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
    </div>
  );
}
