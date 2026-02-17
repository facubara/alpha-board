"use client";

/**
 * ReasoningLog Tab
 *
 * Full log of every decision (including holds), searchable and filterable.
 */

import { useState, useMemo } from "react";
import { Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { AgentDecision } from "@/lib/types";

interface ReasoningLogProps {
  decisions: AgentDecision[];
}

const ACTION_LABELS: Record<string, string> = {
  open_long: "Long",
  open_short: "Short",
  close_position: "Close",
  adjust_stop_loss: "Adj SL",
  adjust_take_profit: "Adj TP",
  hold: "Hold",
};

const ACTION_FILTERS = [
  "all",
  "open_long",
  "open_short",
  "close_position",
  "hold",
] as const;

export function ReasoningLog({ decisions }: ReasoningLogProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let result = [...decisions];

    if (actionFilter !== "all") {
      result = result.filter((d) => d.action === actionFilter);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.reasoningSummary.toLowerCase().includes(term) ||
          d.reasoningFull.toLowerCase().includes(term) ||
          (d.symbol && d.symbol.toLowerCase().includes(term))
      );
    }

    return result;
  }, [decisions, actionFilter, search]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Action filter */}
        <div className="flex items-center gap-1">
          {ACTION_FILTERS.map((action) => (
            <button
              key={action}
              onClick={() => setActionFilter(action)}
              className={cn(
                "rounded-md px-2.5 py-1.5 font-mono text-xs font-medium transition-colors-fast",
                actionFilter === action
                  ? "border border-[var(--border-strong)] bg-[var(--bg-surface)] text-primary"
                  : "text-secondary hover:bg-[var(--bg-elevated)] hover:text-primary"
              )}
            >
              {action === "all" ? "All" : ACTION_LABELS[action] || action}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            type="text"
            placeholder="Search reasoning..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-52 pl-8 font-mono text-sm"
          />
        </div>
      </div>

      {/* Count */}
      {(search.trim() || actionFilter !== "all") && (
        <p className="text-xs text-secondary">
          {filtered.length} of {decisions.length} decisions
        </p>
      )}

      {/* Decision list */}
      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
          <p className="text-sm text-muted">No decisions match</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              isExpanded={expandedId === decision.id}
              onToggle={() =>
                setExpandedId(
                  expandedId === decision.id ? null : decision.id
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DecisionCard({
  decision,
  isExpanded,
  onToggle,
}: {
  decision: AgentDecision;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const actionLabel = ACTION_LABELS[decision.action] || decision.action;
  const isTradeAction =
    decision.action === "open_long" || decision.action === "open_short";
  const isClose = decision.action === "close_position";

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border-default)] transition-colors-fast",
        isExpanded ? "bg-[var(--bg-surface)]" : "hover:bg-[var(--bg-elevated)]"
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        {/* Action badge */}
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
            decision.action === "open_long" && "bg-[var(--bullish-subtle)] text-bullish",
            decision.action === "open_short" && "bg-[var(--bearish-subtle)] text-bearish",
            isClose && "bg-[var(--bg-muted)] text-primary",
            decision.action === "hold" && "bg-[var(--bg-muted)] text-muted",
            !isTradeAction && !isClose && decision.action !== "hold" && "bg-[var(--bg-muted)] text-secondary"
          )}
        >
          {actionLabel}
        </span>

        {/* Symbol */}
        {decision.symbol && (
          <span className="shrink-0 font-mono text-sm font-semibold text-primary">
            {decision.symbol}
          </span>
        )}

        {/* Summary */}
        <span className="min-w-0 flex-1 truncate text-sm text-secondary">
          {decision.reasoningSummary}
        </span>

        {/* Timestamp */}
        <span className="hidden shrink-0 font-mono text-xs text-muted sm:block" title={new Date(decision.decidedAt).toISOString()}>
          {new Date(decision.decidedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
        </span>

        {/* Chevron */}
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150",
            isExpanded && "rotate-90"
          )}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[var(--border-subtle)] px-3 py-3">
          {/* Meta */}
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
            <span>Model: <span className="font-mono text-secondary">{decision.modelUsed}</span></span>
            <span>Tokens: <span className="font-mono text-secondary">{(decision.inputTokens + decision.outputTokens).toLocaleString()}</span></span>
            <span>Cost: <span className="font-mono text-secondary">${decision.estimatedCostUsd.toFixed(4)}</span></span>
            <span>Prompt v{decision.promptVersion}</span>
          </div>
          {/* Full reasoning */}
          <div className="max-h-96 overflow-y-auto rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-secondary">
              {decision.reasoningFull}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
