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
  running: "bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]",
  paused: "bg-[var(--warning)]/10 text-[var(--warning)]",
  completed: "bg-[var(--bullish-subtle)] text-bullish",
  failed: "bg-[var(--bearish-subtle)] text-bearish",
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
      <p className="text-sm text-muted">No processing runs yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-default)] text-left text-xs text-muted">
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
              className="border-b border-[var(--border-default)] last:border-b-0"
            >
              <td className="px-4 py-2 font-medium text-primary">
                {TASK_LABELS[run.taskType] || run.taskType}
              </td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
                    STATUS_STYLES[run.status]
                  )}
                >
                  {run.status}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs text-secondary">
                {run.processedItems}/{run.totalItems}
              </td>
              <td
                className={cn(
                  "px-4 py-2 text-right font-mono text-xs",
                  run.errorCount > 0 ? "text-bearish" : "text-muted"
                )}
              >
                {run.errorCount}
              </td>
              <td className="px-4 py-2 text-right text-xs text-muted">
                {timeAgo(run.startedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
