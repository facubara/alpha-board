"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentLeaderboardRow, AgentSource } from "@/lib/types";
import { AGENT_SOURCE_LABELS } from "@/lib/types";

const SOURCE_BADGE: Record<AgentSource, string> = {
  technical: "TECH",
  tweet: "TW",
  hybrid: "HYB",
};

interface DiscardedAgentsProps {
  agents: AgentLeaderboardRow[];
}

export function DiscardedAgents({ agents }: DiscardedAgentsProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState(agents);
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const { requireAuth } = useAuth();

  const handleReactivate = useCallback(
    (id: number) => {
      requireAuth(async () => {
        setActionLoading((prev) => ({ ...prev, [id]: "reactivate" }));
        try {
          const res = await fetch(`/api/agents/${id}/reactivate`, {
            method: "POST",
          });
          if (res.ok) {
            setItems((prev) => prev.filter((a) => a.id !== id));
          }
        } finally {
          setActionLoading((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      });
    },
    [requireAuth]
  );

  const handleDelete = useCallback(
    (id: number, name: string) => {
      if (!confirm(`Permanently delete agent "${name}" and all its data? This cannot be undone.`)) {
        return;
      }
      requireAuth(async () => {
        setActionLoading((prev) => ({ ...prev, [id]: "delete" }));
        try {
          const res = await fetch(`/api/agents/${id}/delete`, {
            method: "DELETE",
          });
          if (res.ok) {
            setItems((prev) => prev.filter((a) => a.id !== id));
          }
        } finally {
          setActionLoading((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      });
    },
    [requireAuth]
  );

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-secondary transition-colors-fast hover:text-primary"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Discarded Agents ({items.length})
      </button>

      {expanded && (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
                <TableHead className="text-xs font-medium text-secondary">
                  Agent
                </TableHead>
                <TableHead className="hidden text-xs font-medium text-secondary sm:table-cell">
                  TF
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-secondary">
                  Realized
                </TableHead>
                <TableHead className="hidden text-xs font-medium text-secondary md:table-cell">
                  Reason
                </TableHead>
                <TableHead className="hidden text-xs font-medium text-secondary lg:table-cell">
                  Discarded
                </TableHead>
                <TableHead className="w-24 text-right text-xs font-medium text-secondary">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((agent) => (
                <TableRow
                  key={agent.id}
                  className="h-10 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]"
                >
                  <TableCell className="py-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-primary">
                        {agent.displayName}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1 py-0.5 font-mono text-[10px] font-semibold leading-none",
                          agent.source === "technical" && "bg-[var(--bg-muted)] text-secondary",
                          agent.source === "tweet" && "bg-blue-500/10 text-blue-400",
                          agent.source === "hybrid" && "bg-purple-500/10 text-purple-400"
                        )}
                      >
                        {SOURCE_BADGE[agent.source]}
                      </span>
                      {agent.engine === "rule" && (
                        <span className="rounded bg-[var(--bg-muted)] px-1 py-0.5 font-mono text-[10px] font-semibold leading-none text-muted">
                          RULE
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden py-0 font-mono text-xs text-secondary sm:table-cell">
                    {agent.timeframe}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "py-0 text-right font-mono text-sm",
                      agent.totalRealizedPnl >= 0 ? "text-bullish" : "text-bearish"
                    )}
                  >
                    {agent.totalRealizedPnl >= 0 ? "+" : ""}$
                    {agent.totalRealizedPnl.toFixed(2)}
                  </TableCell>
                  <TableCell className="hidden max-w-xs truncate py-0 text-xs text-muted md:table-cell">
                    {agent.discardReason || "—"}
                  </TableCell>
                  <TableCell className="hidden py-0 font-mono text-xs text-muted lg:table-cell">
                    {agent.discardedAt
                      ? new Date(agent.discardedAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="py-0 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleReactivate(agent.id)}
                        disabled={!!actionLoading[agent.id]}
                        className="rounded p-1 text-secondary transition-colors-fast hover:bg-[var(--bg-muted)] hover:text-bullish disabled:opacity-50"
                        title="Re-activate"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(agent.id, agent.displayName)
                        }
                        disabled={!!actionLoading[agent.id]}
                        className="rounded p-1 text-secondary transition-colors-fast hover:bg-[var(--bg-muted)] hover:text-bearish disabled:opacity-50"
                        title="Delete permanently"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
