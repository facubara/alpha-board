"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProcessingTaskSummary } from "@/lib/types";
import { DottedProgress } from "@/components/terminal";

const TASK_LABELS: Record<string, string> = {
  tweet_sentiment: "Tweet Sentiment",
  memecoin_sentiment: "Memecoin Sentiment",
  agent_review: "Agent Reviews",
  trade_memory: "Trade Memory",
  post_mortem: "Post-Mortem",
};

const TASK_COMMANDS: Record<string, string> = {
  tweet_sentiment: "Process unanalyzed tweets",
  memecoin_sentiment: "Process unanalyzed memecoin tweets",
  agent_review: "Review agents that haven't been analyzed recently",
  trade_memory: "Generate trade memories for unprocessed trades",
  post_mortem: "Run post-mortem on discarded agents",
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

const STATUS_STYLES: Record<string, string> = {
  running: "text-text-secondary",
  paused: "text-terminal-amber",
  completed: "text-data-profit",
  failed: "text-data-loss",
};

const STATUS_ICONS: Record<string, string> = {
  running: "\u25B6",
  paused: "\u23F8",
  completed: "\u2713",
  failed: "\u2717",
};

export function TaskCard({ task }: { task: ProcessingTaskSummary }) {
  const [showCommand, setShowCommand] = useState(false);

  return (
    <div className="rounded-none border border-void-border bg-void-surface p-4">
      <h3 className="text-sm font-medium text-text-secondary">
        {TASK_LABELS[task.taskType] || task.taskType}
      </h3>

      <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
        {task.pendingCount}
      </p>
      <p className="text-xs text-text-tertiary">pending</p>

      {/* Last run info */}
      {task.lastRun && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={cn("font-medium", STATUS_STYLES[task.lastRun.status])}>
            {STATUS_ICONS[task.lastRun.status]} {task.lastRun.status}
          </span>
          {task.lastRun.status === "completed" || task.lastRun.status === "failed" ? (
            <span className="text-text-tertiary">
              {task.lastRun.processedItems}/{task.lastRun.totalItems}
              {task.lastRun.errorCount > 0 && (
                <span className="text-data-loss"> ({task.lastRun.errorCount} err)</span>
              )}
            </span>
          ) : (
            <span className="text-text-tertiary">
              {task.lastRun.processedItems}/{task.lastRun.totalItems}
            </span>
          )}
          <span className="text-text-tertiary">{timeAgo(task.lastRun.startedAt)}</span>
        </div>
      )}
      {/* Progress bar */}
      {task.lastRun && task.lastRun.totalItems > 0 && (
        <div className="mt-2">
          <DottedProgress progress={Math.round((task.lastRun.processedItems / task.lastRun.totalItems) * 100)} />
        </div>
      )}

      {!task.lastRun && (
        <p className="mt-3 text-xs text-text-tertiary">No runs yet</p>
      )}

      {/* Run button */}
      <button
        onClick={() => setShowCommand((v) => !v)}
        disabled={task.pendingCount === 0}
        className={cn(
          "mt-4 w-full font-mono text-xs uppercase tracking-widest border transition-colors px-4 py-1.5",
          task.pendingCount > 0
            ? "border-void-border text-text-secondary hover:text-terminal-amber hover:border-terminal-amber"
            : "cursor-not-allowed border-void-border text-text-tertiary"
        )}
      >
        [ EXECUTE ]
      </button>

      {/* Command instructions */}
      {showCommand && task.pendingCount > 0 && (
        <div className="mt-3 rounded-none border border-void-border bg-void p-3 text-xs">
          <p className="text-text-tertiary">Tell Claude Code:</p>
          <p className="mt-1 font-medium text-text-primary">
            &ldquo;{TASK_COMMANDS[task.taskType]}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
