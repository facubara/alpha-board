"use client";

/**
 * AccountManager — Add/remove tracked Twitter accounts.
 *
 * Collapsible sorted table view with follower counts and bios.
 */

import { useReducer, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
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

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return null;
  return sortDirection === "asc" ? (
    <ChevronUp className="inline h-3 w-3" />
  ) : (
    <ChevronDown className="inline h-3 w-3" />
  );
}

// ─── Reducer ───
interface AccountState {
  // react-doctor: intentional — local mutation of server-fetched initial data
  accounts: TwitterAccount[];
  showForm: boolean;
  expanded: boolean;
  handle: string;
  displayName: string;
  category: TwitterAccountCategory;
  error: string | null;
  search: string;
  sortField: SortField;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

type AccountAction =
  | { type: "SET_SHOW_FORM"; value: boolean }
  | { type: "SET_EXPANDED"; value: boolean }
  | { type: "SET_HANDLE"; value: string }
  | { type: "SET_DISPLAY_NAME"; value: string }
  | { type: "SET_CATEGORY"; value: TwitterAccountCategory }
  | { type: "SET_ERROR"; value: string | null }
  | { type: "SET_SEARCH"; value: string }
  | { type: "TOGGLE_SORT"; field: SortField }
  | { type: "SET_PAGE"; value: number }
  | { type: "SET_PAGE_SIZE"; value: number }
  | { type: "ADD_ACCOUNT"; account: TwitterAccount }
  | { type: "REMOVE_ACCOUNT"; id: number };

function accountReducer(state: AccountState, action: AccountAction): AccountState {
  switch (action.type) {
    case "SET_SHOW_FORM":
      return { ...state, showForm: action.value };
    case "SET_EXPANDED":
      return { ...state, expanded: action.value };
    case "SET_HANDLE":
      return { ...state, handle: action.value };
    case "SET_DISPLAY_NAME":
      return { ...state, displayName: action.value };
    case "SET_CATEGORY":
      return { ...state, category: action.value };
    case "SET_ERROR":
      return { ...state, error: action.value };
    case "SET_SEARCH":
      return { ...state, search: action.value, page: 0 };
    case "TOGGLE_SORT": {
      if (state.sortField === action.field) {
        return { ...state, sortDirection: state.sortDirection === "asc" ? "desc" : "asc", page: 0 };
      }
      return {
        ...state,
        sortField: action.field,
        sortDirection: action.field === "handle" || action.field === "category" ? "asc" : "desc",
        page: 0,
      };
    }
    case "SET_PAGE":
      return { ...state, page: action.value };
    case "SET_PAGE_SIZE":
      return { ...state, pageSize: action.value, page: 0 };
    case "ADD_ACCOUNT":
      return {
        ...state,
        accounts: [{ ...action.account, tweetCount: 0 }, ...state.accounts],
        handle: "",
        displayName: "",
        showForm: false,
      };
    case "REMOVE_ACCOUNT":
      return { ...state, accounts: state.accounts.filter((a) => a.id !== action.id) };
  }
}

export function AccountManager({ initialAccounts }: AccountManagerProps) {
  const router = useRouter();
  const { requireAuth } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [state, dispatch] = useReducer(accountReducer, {
    accounts: initialAccounts,
    showForm: false,
    expanded: false,
    handle: "",
    displayName: "",
    category: "analyst",
    error: null,
    search: "",
    sortField: "followers",
    sortDirection: "desc",
    page: 0,
    pageSize: 25,
  });

  const sorted = useMemo(() => {
    let list = [...state.accounts];

    if (state.search.trim()) {
      const term = state.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.handle.toLowerCase().includes(term) ||
          a.category.toLowerCase().includes(term) ||
          (a.bio ?? "").toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (state.sortField) {
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
      return state.sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [state.accounts, state.search, state.sortField, state.sortDirection]);

  const totalPages = Math.ceil(sorted.length / state.pageSize);
  const paginated = useMemo(
    () => sorted.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize),
    [sorted, state.page, state.pageSize]
  );

  async function doAdd() {
    if (!state.handle.trim()) return;
    dispatch({ type: "SET_ERROR", value: null });

    const resolvedDisplayName = state.displayName.trim() || state.handle.replace(/^@/, "").trim();

    let res: Response | null = null;
    try {
      res = await fetch("/api/twitter/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: state.handle, displayName: resolvedDisplayName, category: state.category }),
      });
    } catch {
      dispatch({ type: "SET_ERROR", value: "Failed to add account" });
      return;
    }

    if (!res.ok) {
      let errMsg = "Failed to add account";
      try {
        const data = await res.json();
        errMsg = data.error || errMsg;
      } catch { /* ignore */ }
      dispatch({ type: "SET_ERROR", value: errMsg });
      return;
    }

    const newAccount = await res.json();
    dispatch({ type: "ADD_ACCOUNT", account: newAccount });
    startTransition(() => router.refresh());
  }

  function handleAdd() {
    requireAuth(() => doAdd());
  }

  async function doDelete(id: number) {
    let res: Response | null = null;
    try {
      res = await fetch("/api/twitter/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      return;
    }

    if (res.ok) {
      dispatch({ type: "REMOVE_ACCOUNT", id });
      startTransition(() => router.refresh());
    }
  }

  function handleDelete(id: number) {
    requireAuth(() => doDelete(id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => dispatch({ type: "SET_EXPANDED", value: !state.expanded })}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-secondary transition-colors"
        >
          {state.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Tracked Accounts ({state.accounts.length})
        </button>
        <button
          onClick={() => { dispatch({ type: "SET_SHOW_FORM", value: !state.showForm }); if (!state.expanded) dispatch({ type: "SET_EXPANDED", value: true }); }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-secondary transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Add Account
        </button>
      </div>

      {/* Search */}
      {state.expanded && state.accounts.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={state.search}
            onChange={(e) => dispatch({ type: "SET_SEARCH", value: e.target.value })}
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-base)] py-1.5 pl-8 pr-3 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none sm:w-64"
          />
        </div>
      )}

      {/* Add form */}
      {state.showForm && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="@handle"
              value={state.handle}
              onChange={(e) => dispatch({ type: "SET_HANDLE", value: e.target.value })}
              className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none"
            />
            <input
              type="text"
              placeholder="Display Name (optional)"
              value={state.displayName}
              onChange={(e) => dispatch({ type: "SET_DISPLAY_NAME", value: e.target.value })}
              className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none"
            />
            <select
              value={state.category}
              onChange={(e) => dispatch({ type: "SET_CATEGORY", value: e.target.value as TwitterAccountCategory })}
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
              disabled={!state.handle.trim()}
              className="rounded bg-[var(--primary)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {state.error && <p className="text-xs text-red-400">{state.error}</p>}
        </div>
      )}

      {/* Account table (collapsible) */}
      {state.expanded && (
        state.accounts.length === 0 ? (
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
                    onClick={() => dispatch({ type: "TOGGLE_SORT", field: "handle" })}
                  >
                    Handle <SortIcon field="handle" sortField={state.sortField} sortDirection={state.sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary"
                    onClick={() => dispatch({ type: "TOGGLE_SORT", field: "category" })}
                  >
                    Category <SortIcon field="category" sortField={state.sortField} sortDirection={state.sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary text-right"
                    onClick={() => dispatch({ type: "TOGGLE_SORT", field: "followers" })}
                  >
                    Followers <SortIcon field="followers" sortField={state.sortField} sortDirection={state.sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary text-right"
                    onClick={() => dispatch({ type: "TOGGLE_SORT", field: "tweets" })}
                  >
                    Tweets <SortIcon field="tweets" sortField={state.sortField} sortDirection={state.sortDirection} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-xs text-muted hover:text-primary"
                    onClick={() => dispatch({ type: "TOGGLE_SORT", field: "bio" })}
                  >
                    Bio <SortIcon field="bio" sortField={state.sortField} sortDirection={state.sortDirection} />
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
                    onClick={() => dispatch({ type: "SET_PAGE_SIZE", value: size })}
                    className={`rounded px-1.5 py-0.5 ${state.pageSize === size ? "bg-[var(--bg-elevated)] text-primary font-medium" : "hover:text-primary"}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>
                  {state.page * state.pageSize + 1}–{Math.min((state.page + 1) * state.pageSize, sorted.length)} of {sorted.length}
                  {state.search.trim() && ` (${state.accounts.length} total)`}
                </span>
                <button
                  onClick={() => dispatch({ type: "SET_PAGE", value: Math.max(0, state.page - 1) })}
                  disabled={state.page === 0}
                  className="rounded p-0.5 hover:text-primary disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => dispatch({ type: "SET_PAGE", value: Math.min(totalPages - 1, state.page + 1) })}
                  disabled={state.page >= totalPages - 1}
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
