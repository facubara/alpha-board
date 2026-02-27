/**
 * Processing Queries
 *
 * Fetches processing run data from the worker API.
 */

import { workerGet } from "@/lib/worker-client";
import type { ProcessingRun, ProcessingTaskSummary, AgentAnalysis } from "@/lib/types";

/**
 * Get pending counts and last run for each of the 5 task types.
 */
export async function getProcessingTaskSummaries(): Promise<ProcessingTaskSummary[]> {
  return workerGet<ProcessingTaskSummary[]>("/processing/summaries");
}

/**
 * Get recent processing run history.
 */
export async function getProcessingRunHistory(
  limit: number = 20
): Promise<ProcessingRun[]> {
  return workerGet<ProcessingRun[]>(`/processing/runs?limit=${limit}`);
}

/**
 * Get analysis history for a specific agent.
 */
export async function getAgentAnalysisHistory(
  agentId: number
): Promise<AgentAnalysis[]> {
  return workerGet<AgentAnalysis[]>(`/processing/agents/${agentId}/analysis`);
}
