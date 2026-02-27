/**
 * LLM Settings Queries
 *
 * Fetches LLM settings and cost data from the worker API.
 */

import { workerGet, workerPost } from "@/lib/worker-client";
import type { LlmSection, LlmSectionCost } from "@/lib/types";

/**
 * Fetch all LLM settings rows.
 */
export async function getLlmSettings(): Promise<LlmSection[]> {
  return workerGet<LlmSection[]>("/settings/llm");
}

/**
 * Fetch cost breakdown per section (alltime + 30d).
 */
export async function getLlmCosts(): Promise<LlmSectionCost[]> {
  return workerGet<LlmSectionCost[]>("/settings/llm/costs");
}

/**
 * Toggle a section's enabled state. Returns the updated row.
 */
export async function toggleLlmSection(
  key: string
): Promise<{ key: string; enabled: boolean } | null> {
  return workerPost<{ key: string; enabled: boolean } | null>(
    `/settings/llm/${key}/toggle`
  );
}
