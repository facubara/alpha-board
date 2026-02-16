"use client";

/**
 * AccountManager — Add/remove tracked Twitter accounts.
 *
 * Shows a list of tracked accounts with category badges,
 * and a form to add new ones.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Loader2 } from "lucide-react";
import type { TwitterAccount, TwitterAccountCategory } from "@/lib/types";
import { TWITTER_CATEGORIES, TWITTER_CATEGORY_LABELS } from "@/lib/types";

const CATEGORY_BADGE_COLORS: Record<TwitterAccountCategory, string> = {
  analyst: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  founder: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  news: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  degen: "bg-red-500/10 text-red-400 border-red-500/20",
  insider: "bg-green-500/10 text-green-400 border-green-500/20",
  protocol: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

interface AccountManagerProps {
  initialAccounts: TwitterAccount[];
}

export function AccountManager({ initialAccounts }: AccountManagerProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<TwitterAccount[]>(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState<TwitterAccountCategory>("analyst");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
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

  async function handleDelete(id: number) {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-primary">
          Tracked Accounts ({accounts.length})
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
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

      {/* Account list */}
      {accounts.length === 0 ? (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-muted">
          No accounts tracked yet. Add accounts to start ingesting tweets.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="group flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5"
            >
              <span className="text-sm text-primary">@{account.handle}</span>
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                  CATEGORY_BADGE_COLORS[account.category]
                }`}
              >
                {TWITTER_CATEGORY_LABELS[account.category]}
              </span>
              {account.tweetCount != null && account.tweetCount > 0 && (
                <span className="text-xs text-muted">{account.tweetCount}</span>
              )}
              <button
                onClick={() => handleDelete(account.id)}
                className="ml-1 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                title="Remove account"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
