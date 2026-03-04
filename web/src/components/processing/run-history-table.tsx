"use client";

import { cn } from "@/lib/utils";
import type { ProcessingRun } from "@/lib/types";

const TASK_LABELS: Record<string, string> = {
  tweet_sentiment: "Tweets",
  memecoin_sentiment: "Memecoin",
  agent_review: "Agents",
  trade_memory: "Memory",
  post_mortem: "Post-Mortem",
};

const STATUS_STYLES: Record<string, string> = {
  running: "bg-void-muted text-text-secondary",
  paused: "bg-terminal-amber-muted text-terminal-amber",
  completed: "bg-terminal-amber-muted text-data-profit",
  failed: "bg-terminal-amber-muted text-data-loss",
};

const BAR_COLORS: Record<string, string> = {
  running: "bg-text-secondary",
  paused: "bg-terminal-amber",
  completed: "bg-terminal-amber-muted",
  failed: "bg-terminal-amber-muted",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RunHistoryTable({ runs }: { runs: ProcessingRun[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">No processing runs yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-none border border-void-border bg-void-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-void-border text-left text-xs text-text-tertiary">
            <th className="px-4 py-2 font-medium">Task</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium text-right">Progress</th>
            <th className="px-4 py-2 font-medium text-right">Errors</th>
            <th className="px-4 py-2 font-medium text-right">Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              className="border-b border-void-border last:border-b-0"
            >
              <td className="px-4 py-2 font-medium text-text-primary">
                {TASK_LABELS[run.taskType] || run.taskType}
              </td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    "inline-flex rounded-none px-1.5 py-0.5 text-xs font-medium",
                    STATUS_STYLES[run.status]
                  )}
                >
                  {run.status}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  {run.totalItems > 0 && (
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-void-muted">
                      <div
                        className={cn("h-full rounded-full", BAR_COLORS[run.status])}
                        style={{
                          width: `${Math.round((run.processedItems / run.totalItems) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  <span className="font-mono text-xs text-text-secondary">
                    {run.processedItems}/{run.totalItems}
                  </span>
                </div>
              </td>
              <td
                className={cn(
                  "px-4 py-2 text-right font-mono text-xs",
                  run.errorCount > 0 ? "text-data-loss" : "text-text-tertiary"
                )}
              >
                {run.errorCount}
              </td>
              <td className="px-4 py-2 text-right text-xs text-text-tertiary">
                {timeAgo(run.startedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
