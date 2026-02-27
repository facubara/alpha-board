"use client";

import type { ProcessingTaskSummary, ProcessingRun } from "@/lib/types";
import { TaskCard } from "./task-card";
import { RunHistoryTable } from "./run-history-table";

interface ProcessingDashboardProps {
  taskSummaries: ProcessingTaskSummary[];
  runHistory: ProcessingRun[];
}

export function ProcessingDashboard({
  taskSummaries,
  runHistory,
}: ProcessingDashboardProps) {
  const totalPending = taskSummaries.reduce((sum, t) => sum + t.pendingCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Manual Processing</h1>
        <p className="mt-1 text-sm text-secondary">
          Run LLM analysis tasks using Claude Code.{" "}
          <span className="font-mono text-xs text-muted">
            {totalPending} total pending
          </span>
        </p>
      </div>

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
