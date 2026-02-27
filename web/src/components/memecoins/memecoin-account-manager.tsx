"use client";

/**
 * MemecoinAccountManager — CRUD for memecoin Twitter accounts.
 * Collapsible sorted table with VIP toggle, follower counts, and bios.
 */

import { useReducer, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Search, Star, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
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
import { MemecoinCallHistoryModal } from "./memecoin-call-history-modal";

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

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return null;
  return sortDirection === "asc" ? (
    <ChevronUp className="inline h-3 w-3" />
  ) : (
    <ChevronDown className="inline h-3 w-3" />
  );
}

// ─── Reducer ───
interface MemecoinAccountState {
  // react-doctor: intentional — local mutation of server-fetched initial data
  accounts: MemecoinTwitterAccount[];
  showForm: boolean;
  expanded: boolean;
  handle: string;
  displayName: string;
  category: MemecoinCategory;
  isVip: boolean;
  error: string | null;
  search: string;
  deletingId: number | null;
  selectedAccount: MemecoinTwitterAccount | null;
  callHistory: AccountCallHistoryItem[];
  loadingCalls: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

type MemecoinAccountAction =
  | { type: "SET_SHOW_FORM"; value: boolean }
  | { type: "SET_EXPANDED"; value: boolean }
  | { type: "SET_HANDLE"; value: string }
  | { type: "SET_DISPLAY_NAME"; value: string }
  | { type: "SET_CATEGORY"; value: MemecoinCategory }
  | { type: "SET_VIP"; value: boolean }
  | { type: "SET_ERROR"; value: string | null }
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_DELETING_ID"; value: number | null }
  | { type: "SET_SELECTED_ACCOUNT"; value: MemecoinTwitterAccount | null }
  | { type: "SET_CALL_HISTORY"; value: AccountCallHistoryItem[] }
  | { type: "SET_LOADING_CALLS"; value: boolean }
  | { type: "TOGGLE_SORT"; field: SortField }
  | { type: "SET_PAGE"; value: number }
  | { type: "SET_PAGE_SIZE"; value: number }
  | { type: "ADD_ACCOUNT"; account: MemecoinTwitterAccount }
  | { type: "REMOVE_ACCOUNT"; id: number }
  | { type: "TOGGLE_VIP"; id: number; isVip: boolean };

function memecoinAccountReducer(state: MemecoinAccountState, action: MemecoinAccountAction): MemecoinAccountState {
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
    case "SET_VIP":
      return { ...state, isVip: action.value };
    case "SET_ERROR":
      return { ...state, error: action.value };
    case "SET_SEARCH":
      return { ...state, search: action.value, page: 0 };
    case "SET_DELETING_ID":
      return { ...state, deletingId: action.value };
    case "SET_SELECTED_ACCOUNT":
      return { ...state, selectedAccount: action.value };
    case "SET_CALL_HISTORY":
      return { ...state, callHistory: action.value };
    case "SET_LOADING_CALLS":
      return { ...state, loadingCalls: action.value };
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
        isVip: false,
        showForm: false,
      };
    case "REMOVE_ACCOUNT":
      return { ...state, accounts: state.accounts.filter((a) => a.id !== action.id) };
    case "TOGGLE_VIP":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.id ? { ...a, isVip: action.isVip } : a
        ),
      };
  }
}

export function MemecoinAccountManager({
  initialAccounts,
}: MemecoinAccountManagerProps) {
  const router = useRouter();
  const { requireAuth } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [state, dispatch] = useReducer(memecoinAccountReducer, {
    accounts: initialAccounts,
    showForm: false,
    expanded: false,
    handle: "",
    displayName: "",
    category: "caller",
    isVip: false,
    error: null,
    search: "",
    deletingId: null,
    selectedAccount: null,
    callHistory: [],
    loadingCalls: false,
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

    const resolvedDisplayName =
      state.displayName.trim() || state.handle.replace(/^@/, "").trim();

    let res: Response | null = null;
    try {
      res = await fetch("/api/memecoins/twitter/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: state.handle,
          displayName: resolvedDisplayName,
          category: state.category,
          isVip: state.isVip,
        }),
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
      res = await fetch("/api/memecoins/twitter/accounts", {
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

  async function doToggleVip(id: number) {
    let res: Response | null = null;
    try {
      res = await fetch(`/api/memecoins/twitter/accounts/${id}/vip`, {
        method: "PATCH",
      });
    } catch {
      return;
    }

    if (res.ok) {
      const data = await res.json();
      dispatch({ type: "TOGGLE_VIP", id, isVip: data.isVip });
    }
  }

  function handleToggleVip(id: number) {
    requireAuth(() => doToggleVip(id));
  }

  const handleAccountClick = useCallback(async (account: MemecoinTwitterAccount) => {
    dispatch({ type: "SET_SELECTED_ACCOUNT", value: account });
    dispatch({ type: "SET_LOADING_CALLS", value: true });

    let data: AccountCallHistoryItem[] = [];
    try {
      const res = await fetch(`/api/memecoins/twitter/accounts/${account.id}/calls`);
      if (res.ok) {
        data = await res.json();
      }
    } catch {
      // silent
    }

    dispatch({ type: "SET_CALL_HISTORY", value: data });
    dispatch({ type: "SET_LOADING_CALLS", value: false });
  }, []);

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
              onChange={(e) => dispatch({ type: "SET_CATEGORY", value: e.target.value as MemecoinCategory })}
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
                checked={state.isVip}
                onChange={(e) => dispatch({ type: "SET_VIP", value: e.target.checked })}
                className="rounded"
              />
              VIP
            </label>
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
            No memecoin accounts tracked yet.
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
                        {state.deletingId === account.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => { handleDelete(account.id); dispatch({ type: "SET_DELETING_ID", value: null }); }}
                              className="font-medium text-red-400 hover:text-red-300"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => dispatch({ type: "SET_DELETING_ID", value: null })}
                              className="font-medium text-muted hover:text-primary"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => dispatch({ type: "SET_DELETING_ID", value: account.id })}
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

      {/* Account Call History Modal */}
      {state.selectedAccount && (
        <MemecoinCallHistoryModal
          account={state.selectedAccount}
          callHistory={state.callHistory}
          loadingCalls={state.loadingCalls}
          onClose={() => dispatch({ type: "SET_SELECTED_ACCOUNT", value: null })}
        />
      )}
    </div>
  );
}
