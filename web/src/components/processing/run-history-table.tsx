"use client";

import type { ProcessingRun } from "@/lib/types";
import { DottedProgress } from "@/components/terminal";

const TASK_LABELS: Record<string, string> = {
  tweet_sentiment: "Tweets",
  memecoin_sentiment: "Memecoin",
  agent_review: "Agents",
  trade_memory: "Memory",
  post_mortem: "Post-Mortem",
};

const BADGE_STYLES: Record<string, string> = {
  running: "text-text-secondary border-void-border",
  paused: "text-terminal-amber border-terminal-amber/30 bg-terminal-amber/10",
  completed: "text-data-profit border-data-profit/30 bg-data-profit/10",
  failed: "text-data-loss border-data-loss/30 bg-data-loss/10",
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
      <p className="font-mono text-sm text-text-tertiary">No processing runs yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-none border border-void-border bg-void-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-void-border text-left font-mono text-xs text-text-tertiary uppercase tracking-wider">
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
              <td className="px-4 py-2 font-mono font-medium text-text-primary">
                {TASK_LABELS[run.taskType] || run.taskType}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`inline-flex font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${
                    BADGE_STYLES[run.status] ?? BADGE_STYLES.running
                  }`}
                >
                  {run.status}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  {run.totalItems > 0 && (
                    <div className="w-16">
                      <DottedProgress progress={Math.round((run.processedItems / run.totalItems) * 100)} />
                    </div>
                  )}
                  <span className="font-mono text-xs text-text-secondary">
                    {run.processedItems}/{run.totalItems}
                  </span>
                </div>
              </td>
              <td
                className={`px-4 py-2 text-right font-mono text-xs ${
                  run.errorCount > 0 ? "text-data-loss" : "text-text-tertiary"
                }`}
              >
                {run.errorCount}
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs text-text-tertiary">
                {timeAgo(run.startedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
