"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useFetch } from "@/hooks/use-fetch";
import type { ProcessingTaskSummary, ProcessingRun } from "@/lib/types";
import { TaskCard } from "./task-card";
import { RunHistoryTable } from "./run-history-table";

const TASK_COMMANDS: Record<string, string> = {
  tweet_sentiment: "Process unanalyzed tweets",
  memecoin_sentiment: "Process unanalyzed memecoin tweets",
  agent_review: "Review agents that haven't been analyzed recently",
  trade_memory: "Generate trade memories for unprocessed trades",
  post_mortem: "Run post-mortem on discarded agents",
};

const TASK_LABELS: Record<string, string> = {
  tweet_sentiment: "Tweet Sentiment",
  memecoin_sentiment: "Memecoin Sentiment",
  agent_review: "Agent Reviews",
  trade_memory: "Trade Memory",
  post_mortem: "Post-Mortem",
};

interface ProcessingDashboardProps {
  taskSummaries: ProcessingTaskSummary[];
  runHistory: ProcessingRun[];
}

export function ProcessingDashboard({
  taskSummaries: initialSummaries,
  runHistory: initialRuns,
}: ProcessingDashboardProps) {
  const [showRunAll, setShowRunAll] = useState(false);

  // Determine if any runs are active (running)
  const hasActiveRuns = useMemo(() => {
    const allRuns = [...initialRuns];
    for (const t of initialSummaries) {
      if (t.lastRun?.status === "running") return true;
    }
    return allRuns.some((r) => r.status === "running");
  }, [initialSummaries, initialRuns]);

  // Poll only when there are active runs
  const pollInterval = hasActiveRuns ? 5000 : undefined;

  const { data: polledSummaries } = useFetch<ProcessingTaskSummary[]>(
    hasActiveRuns ? "/api/processing/summaries" : null,
    { pollInterval }
  );

  const { data: polledRuns } = useFetch<ProcessingRun[]>(
    hasActiveRuns ? "/api/processing/runs?limit=20" : null,
    { pollInterval }
  );

  // Use polled data when available, otherwise fall back to server-rendered
  const taskSummaries = polledSummaries ?? initialSummaries;
  const runHistory = polledRuns ?? initialRuns;

  const totalPending = taskSummaries.reduce((sum, t) => sum + t.pendingCount, 0);
  const pendingTasks = taskSummaries.filter((t) => t.pendingCount > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary">Manual Processing</h1>
          <p className="mt-1 text-sm text-secondary">
            Run LLM analysis tasks using Claude Code.{" "}
            <span className="font-mono text-xs text-muted">
              {totalPending} total pending
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowRunAll((v) => !v)}
          disabled={totalPending === 0}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors-fast",
            totalPending > 0
              ? "bg-[var(--bg-elevated)] text-primary hover:bg-[var(--bg-muted)]"
              : "cursor-not-allowed bg-[var(--bg-muted)] text-muted"
          )}
        >
          Run All
        </button>
      </div>

      {/* Run All panel */}
      {showRunAll && pendingTasks.length > 0 && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <p className="text-xs font-medium text-secondary">
            Tell Claude Code to run each of these:
          </p>
          <div className="mt-3 space-y-2">
            {pendingTasks.map((task) => (
              <div
                key={task.taskType}
                className="flex items-start gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-xs"
              >
                <span className="shrink-0 font-medium text-muted">
                  {TASK_LABELS[task.taskType] || task.taskType}
                </span>
                <span className="font-medium text-primary">
                  &ldquo;{TASK_COMMANDS[task.taskType]}&rdquo;
                </span>
                <span className="ml-auto shrink-0 font-mono text-muted">
                  {task.pendingCount} pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {taskSummaries.map((task) => (
          <TaskCard key={task.taskType} task={task} />
        ))}
      </div>

      {/* Run history */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-secondary">Recent Runs</h2>
        <RunHistoryTable runs={runHistory} />
      </div>
    </div>
  );
}
