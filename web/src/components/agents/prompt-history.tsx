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
  initial: "bg-void-muted text-text-secondary",
  auto: "bg-terminal-amber-muted text-terminal-amber",
  human: "bg-terminal-amber-muted text-data-profit",
};

export function PromptHistory({ versions }: PromptHistoryProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (versions.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-none border border-void-border bg-void-surface">
        <p className="text-xs text-text-tertiary">No prompt history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-text-secondary">
        Version History ({versions.length})
      </h3>

      <div className="space-y-1">
        {versions.map((ver) => {
          const isExpanded = expandedId === ver.id;
          return (
            <div
              key={ver.id}
              className={cn(
                "rounded-none border border-void-border transition-colors-fast",
                isExpanded ? "bg-void-surface" : "hover:bg-void-muted"
              )}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : ver.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
              >
                {/* Version number */}
                <span className="shrink-0 font-mono text-sm font-semibold text-text-primary">
                  v{ver.version}
                </span>

                {/* Source badge */}
                <span
                  className={cn(
                    "shrink-0 rounded-none px-1.5 py-0.5 text-xs font-medium",
                    SOURCE_STYLES[ver.source] ?? SOURCE_STYLES.initial
                  )}
                >
                  {ver.source}
                </span>

                {/* Active badge */}
                {ver.isActive && (
                  <span className="shrink-0 rounded-none bg-terminal-amber-muted px-1.5 py-0.5 text-xs font-medium text-data-profit">
                    active
                  </span>
                )}

                {/* Performance at change */}
                {ver.performanceAtChange && (
                  <span className="hidden font-mono text-xs text-text-tertiary sm:block">
                    PnL: {ver.performanceAtChange.pnl?.toFixed(2) ?? "—"} · Trades: {ver.performanceAtChange.trades ?? "—"}
                  </span>
                )}

                {/* Spacer */}
                <span className="flex-1" />

                {/* Date */}
                <span className="shrink-0 font-mono text-xs text-text-tertiary">
                  {formatRelativeTime(ver.createdAt)}
                </span>

                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform duration-150",
                    isExpanded && "rotate-90"
                  )}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-void-border px-3 py-3">
                  {ver.diffFromPrevious && (
                    <div className="mb-3">
                      <p className="mb-1 text-xs font-medium text-text-tertiary">Change</p>
                      <p className="text-xs text-text-secondary">{ver.diffFromPrevious}</p>
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto rounded-none border border-void-border bg-void p-3">
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary">
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
