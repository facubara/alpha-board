/**
 * Agent Queries
 *
 * Fetches agent leaderboard and detail data from the worker API.
 */

import { cached } from "@/lib/cache";
import { workerGet, workerPost, workerDelete, workerPatch } from "@/lib/worker-client";
import type {
  AgentDecision,
  AgentDetail,
  AgentLeaderboardRow,
  AgentPosition,
  AgentPromptVersion,
  AgentStatus,
  AgentTokenUsageSummary,
  AgentTrade,
  ComparisonData,
  SymbolAgentActivity,
} from "@/lib/types";

/**
 * Fetch all 28 agents with leaderboard metrics.
 */
export function getAgentLeaderboard(): Promise<AgentLeaderboardRow[]> {
  return cached("agents:leaderboard", 60, async () => {
    return workerGet<AgentLeaderboardRow[]>("/agents/leaderboard");
  });
}

/**
 * Fetch discarded agents for the "Discarded" tab.
 */
export function getDiscardedAgents(): Promise<AgentLeaderboardRow[]> {
  return cached("agents:discarded", 60, async () => {
    return workerGet<AgentLeaderboardRow[]>("/agents/discarded");
  });
}

/**
 * Re-activate a discarded agent (set back to active).
 */
export async function reactivateAgent(agentId: number): Promise<void> {
  await workerPost(`/agents/${agentId}/reactivate`);
}

/**
 * Permanently delete an agent and all associated data.
 */
export async function deleteAgent(agentId: number): Promise<void> {
  await workerDelete(`/agents/${agentId}`);
}

/**
 * Fetch a single agent with full detail.
 */
export async function getAgentDetail(
  agentId: number
): Promise<AgentDetail | null> {
  try {
    return await workerGet<AgentDetail>(`/agents/${agentId}`);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && e.status === 404) {
      return null;
    }
    throw e;
  }
}

/**
 * Fetch trade history for an agent (most recent first).
 */
export async function getAgentTrades(
  agentId: number
): Promise<AgentTrade[]> {
  return workerGet<AgentTrade[]>(`/agents/${agentId}/trades`);
}

/**
 * Fetch decisions for an agent (most recent first).
 */
export async function getAgentDecisions(
  agentId: number
): Promise<AgentDecision[]> {
  return workerGet<AgentDecision[]>(`/agents/${agentId}/decisions`);
}

/**
 * Fetch prompt version history for an agent.
 */
export async function getAgentPromptHistory(
  agentId: number
): Promise<AgentPromptVersion[]> {
  return workerGet<AgentPromptVersion[]>(`/agents/${agentId}/prompts`);
}

/**
 * Fetch open positions for an agent.
 */
export async function getAgentOpenPositions(
  agentId: number
): Promise<AgentPosition[]> {
  return workerGet<AgentPosition[]>(`/agents/${agentId}/positions`);
}

/**
 * Fetch aggregated token usage for an agent.
 */
export async function getAgentTokenUsage(
  agentId: number
): Promise<AgentTokenUsageSummary[]> {
  return workerGet<AgentTokenUsageSummary[]>(`/agents/${agentId}/token-usage`);
}

/**
 * Save a new prompt version (human edit).
 */
export async function saveAgentPrompt(
  agentId: number,
  systemPrompt: string
): Promise<number> {
  const result = await workerPost<{ version: number }>(
    `/agents/${agentId}/prompts`,
    { systemPrompt }
  );
  return result.version;
}

/**
 * Update an agent's model configuration.
 */
export async function updateAgentModels(
  agentId: number,
  scanModel: string,
  tradeModel: string,
  evolutionModel: string
): Promise<void> {
  await workerPatch(`/agents/${agentId}/models`, {
    scanModel,
    tradeModel,
    evolutionModel,
  });
}

/**
 * Pause all LLM-engine agents that are currently active.
 */
export async function pauseAllLlmAgents(): Promise<number> {
  const result = await workerPost<{ count: number }>("/agents/pause-llm");
  return result.count;
}

/**
 * Get all active LLM-engine agents (id + name).
 */
export async function getActiveLlmAgents(): Promise<{ id: number; name: string }[]> {
  return workerGet<{ id: number; name: string }[]>("/agents/active-llm");
}

/**
 * Pause a single agent by ID.
 */
export async function pauseSingleAgent(id: number): Promise<{ id: number; name: string } | null> {
  try {
    return await workerPost<{ id: number; name: string }>(`/agents/${id}/pause`);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && (e.status === 404 || e.status === 400)) {
      return null;
    }
    throw e;
  }
}

/**
 * Fetch comparison data for multiple agents (max 4).
 */
export async function getComparisonData(
  ids: number[]
): Promise<ComparisonData | null> {
  const clamped = ids.slice(0, 4);
  try {
    return await workerGet<ComparisonData>(
      `/agents/compare?ids=${clamped.join(",")}`
    );
  } catch {
    return null;
  }
}

/**
 * Fetch agent activity for a symbol (open positions + recent trades across all agents).
 */
export async function getSymbolAgentActivity(
  symbol: string
): Promise<SymbolAgentActivity> {
  return workerGet<SymbolAgentActivity>(`/agents/symbol/${symbol}/activity`);
}

/**
 * Fetch all open positions across all agents.
 */
export async function getAllOpenPositions(): Promise<AgentPosition[]> {
  return workerGet<AgentPosition[]>("/agents/positions");
}

/**
 * Toggle an agent's status between active and paused.
 */
export async function toggleAgentStatus(
  agentId: number
): Promise<AgentStatus> {
  const result = await workerPost<{ status: AgentStatus }>(
    `/agents/${agentId}/toggle`
  );
  return result.status;
}
