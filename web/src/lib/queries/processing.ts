/**
 * Processing Queries
 *
 * Fetches processing run data and pending counts for manual LLM processing tasks.
 */

import { sql } from "@/lib/db";
import type { ProcessingRun, ProcessingTaskSummary, AgentAnalysis } from "@/lib/types";

const TASK_TYPES = [
  "tweet_sentiment",
  "memecoin_sentiment",
  "agent_review",
  "trade_memory",
  "post_mortem",
] as const;

function mapProcessingRun(row: Record<string, unknown>): ProcessingRun {
  return {
    id: Number(row.id),
    taskType: String(row.task_type),
    status: String(row.status) as ProcessingRun["status"],
    totalItems: Number(row.total_items),
    processedItems: Number(row.processed_items),
    errorCount: Number(row.error_count),
    lastError: row.last_error ? String(row.last_error) : null,
    startedAt: String(row.started_at),
    pausedAt: row.paused_at ? String(row.paused_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

/**
 * Get pending counts and last run for each of the 5 task types.
 */
export async function getProcessingTaskSummaries(): Promise<ProcessingTaskSummary[]> {
  // Get pending counts for all task types in one query
  const pendingRows = await sql`
    SELECT
      'tweet_sentiment' AS task_type,
      (SELECT COUNT(*) FROM tweets t LEFT JOIN tweet_signals s ON s.tweet_id = t.id WHERE s.id IS NULL) AS cnt
    UNION ALL SELECT
      'memecoin_sentiment',
      (SELECT COUNT(*) FROM memecoin_tweets t LEFT JOIN memecoin_tweet_signals s ON s.tweet_id = t.id WHERE s.id IS NULL)
    UNION ALL SELECT
      'agent_review',
      (SELECT COUNT(*) FROM agents a WHERE a.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM agent_analysis_history h WHERE h.agent_id = a.id AND h.created_at > NOW() - INTERVAL '7 days'))
    UNION ALL SELECT
      'trade_memory',
      (SELECT COUNT(*) FROM agent_trades t LEFT JOIN agent_memory m ON m.trade_id = t.id WHERE m.id IS NULL AND t.closed_at IS NOT NULL)
    UNION ALL SELECT
      'post_mortem',
      (SELECT COUNT(*) FROM agents a WHERE a.status = 'discarded'
        AND NOT EXISTS (SELECT 1 FROM fleet_lessons l WHERE l.agent_id = a.id))
  `;

  const pendingMap = new Map<string, number>();
  for (const row of pendingRows) {
    pendingMap.set(String(row.task_type), Number(row.cnt));
  }

  // Get last run for each task type
  const lastRunRows = await sql`
    SELECT DISTINCT ON (task_type)
      id, task_type, status, total_items, processed_items,
      error_count, last_error, started_at, paused_at, completed_at
    FROM processing_runs
    ORDER BY task_type, started_at DESC
  `;

  const lastRunMap = new Map<string, ProcessingRun>();
  for (const row of lastRunRows) {
    lastRunMap.set(String(row.task_type), mapProcessingRun(row));
  }

  return TASK_TYPES.map((taskType) => ({
    taskType,
    pendingCount: pendingMap.get(taskType) ?? 0,
    lastRun: lastRunMap.get(taskType) ?? null,
  }));
}

/**
 * Get recent processing run history.
 */
export async function getProcessingRunHistory(
  limit: number = 20
): Promise<ProcessingRun[]> {
  const rows = await sql`
    SELECT id, task_type, status, total_items, processed_items,
           error_count, last_error, started_at, paused_at, completed_at
    FROM processing_runs
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;

  return rows.map(mapProcessingRun);
}

/**
 * Get analysis history for a specific agent.
 */
export async function getAgentAnalysisHistory(
  agentId: number
): Promise<AgentAnalysis[]> {
  const rows = await sql`
    SELECT id, agent_id, analysis_type, summary, full_analysis,
           recommendations, metrics_snapshot, processing_run_id, created_at
    FROM agent_analysis_history
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    agentId: Number(row.agent_id),
    analysisType: String(row.analysis_type),
    summary: String(row.summary),
    fullAnalysis: String(row.full_analysis),
    recommendations: (row.recommendations as AgentAnalysis["recommendations"]) || [],
    metricsSnapshot: (row.metrics_snapshot as Record<string, unknown>) || {},
    processingRunId: row.processing_run_id ? Number(row.processing_run_id) : null,
    createdAt: String(row.created_at),
  }));
}
