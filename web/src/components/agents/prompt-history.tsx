"use client";

/**
 * PromptHistory Component
 *
 * Timeline of prompt versions with source badges and performance snapshots.
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import type { AgentPromptVersion } from "@/lib/types";

interface PromptHistoryProps {
  versions: AgentPromptVersion[];
}

const SOURCE_STYLES: Record<string, string> = {
  initial: "bg-[var(--bg-muted)] text-secondary",
  auto: "bg-[var(--neutral-muted)] text-[var(--neutral-strong)]",
  human: "bg-[var(--bullish-subtle)] text-bullish",
};

export function PromptHistory({ versions }: PromptHistoryProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (versions.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <p className="text-xs text-muted">No prompt history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-secondary">
        Version History ({versions.length})
      </h3>

      <div className="space-y-1">
        {versions.map((ver) => {
          const isExpanded = expandedId === ver.id;
          return (
            <div
              key={ver.id}
              className={cn(
                "rounded-lg border border-[var(--border-default)] transition-colors-fast",
                isExpanded ? "bg-[var(--bg-surface)]" : "hover:bg-[var(--bg-elevated)]"
              )}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : ver.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
              >
                {/* Version number */}
                <span className="shrink-0 font-mono text-sm font-semibold text-primary">
                  v{ver.version}
                </span>

                {/* Source badge */}
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                    SOURCE_STYLES[ver.source] ?? SOURCE_STYLES.initial
                  )}
                >
                  {ver.source}
                </span>

                {/* Active badge */}
                {ver.isActive && (
                  <span className="shrink-0 rounded bg-[var(--bullish-subtle)] px-1.5 py-0.5 text-xs font-medium text-bullish">
                    active
                  </span>
                )}

                {/* Performance at change */}
                {ver.performanceAtChange && (
                  <span className="hidden font-mono text-xs text-muted sm:block">
                    PnL: {ver.performanceAtChange.pnl?.toFixed(2) ?? "—"} · Trades: {ver.performanceAtChange.trades ?? "—"}
                  </span>
                )}

                {/* Spacer */}
                <span className="flex-1" />

                {/* Date */}
                <span className="shrink-0 font-mono text-xs text-muted">
                  {formatRelativeTime(ver.createdAt)}
                </span>

                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150",
                    isExpanded && "rotate-90"
                  )}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-[var(--border-subtle)] px-3 py-3">
                  {ver.diffFromPrevious && (
                    <div className="mb-3">
                      <p className="mb-1 text-xs font-medium text-muted">Change</p>
                      <p className="text-xs text-secondary">{ver.diffFromPrevious}</p>
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-secondary">
                      {ver.systemPrompt}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
