/**
 * LLM Settings Queries
 *
 * Direct Neon DB reads/writes for per-section cost control toggles.
 */

import { sql } from "@/lib/db";
import type { LlmSection, LlmSectionCost } from "@/lib/types";

/**
 * Fetch all LLM settings rows.
 */
export async function getLlmSettings(): Promise<LlmSection[]> {
  try {
    const rows = await sql`
      SELECT section_key, display_name, description, enabled, has_api_cost, task_type, updated_at
      FROM llm_settings
      ORDER BY section_key
    `;

    return rows.map((row) => ({
      key: row.section_key as string,
      displayName: row.display_name as string,
      description: row.description as string,
      enabled: row.enabled as boolean,
      hasApiCost: row.has_api_cost as boolean,
      taskType: (row.task_type as string) || null,
      updatedAt: (row.updated_at as Date).toISOString(),
    }));
  } catch {
    // Table may not exist yet
    return [];
  }
}

/**
 * Fetch cost breakdown per section (alltime + 30d).
 *
 * Maps task_type from agent_token_usage to section_key.
 * Tweet sentiment costs come from tweet_signals table.
 */
export async function getLlmCosts(): Promise<LlmSectionCost[]> {
  const taskTypeToSection: Record<string, string> = {
    trade: "llm_trade_decisions",
    evolution: "prompt_evolution",
    postmortem: "post_mortem",
    scan: "trade_memory",
  };

  try {
    // Token usage costs grouped by task_type
    const costRows = await sql`
      SELECT
        task_type,
        COALESCE(SUM(estimated_cost_usd), 0) as cost_alltime,
        COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN estimated_cost_usd ELSE 0 END), 0) as cost_30d
      FROM agent_token_usage
      WHERE task_type IN ('trade', 'evolution', 'postmortem', 'scan')
      GROUP BY task_type
    `;

    const costs: LlmSectionCost[] = [];
    for (const row of costRows) {
      const sectionKey = taskTypeToSection[row.task_type as string];
      if (sectionKey) {
        costs.push({
          key: sectionKey,
          costAlltime: Number(row.cost_alltime),
          cost30d: Number(row.cost_30d),
        });
      }
    }

    // Tweet sentiment costs from tweet_signals
    try {
      const tweetCostRows = await sql`
        SELECT
          COALESCE(SUM(estimated_cost_usd), 0) as cost_alltime,
          COALESCE(SUM(CASE WHEN analyzed_at >= CURRENT_DATE - INTERVAL '30 days' THEN estimated_cost_usd ELSE 0 END), 0) as cost_30d
        FROM tweet_signals
      `;
      if (tweetCostRows.length > 0) {
        costs.push({
          key: "tweet_sentiment",
          costAlltime: Number(tweetCostRows[0].cost_alltime),
          cost30d: Number(tweetCostRows[0].cost_30d),
        });
      }
    } catch {
      // tweet_signals table may not have estimated_cost_usd column
    }

    return costs;
  } catch {
    return [];
  }
}

/**
 * Toggle a section's enabled state. Returns the updated row.
 */
export async function toggleLlmSection(
  key: string
): Promise<{ key: string; enabled: boolean } | null> {
  const rows = await sql`
    UPDATE llm_settings
    SET enabled = NOT enabled, updated_at = now()
    WHERE section_key = ${key}
    RETURNING section_key, enabled
  `;

  if (rows.length === 0) return null;

  return {
    key: rows[0].section_key as string,
    enabled: rows[0].enabled as boolean,
  };
}
