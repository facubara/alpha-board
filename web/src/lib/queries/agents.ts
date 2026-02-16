/**
 * Agent Queries
 *
 * Fetches agent leaderboard and detail data from Neon database.
 */

import { cached } from "@/lib/cache";
import { sql } from "@/lib/db";
import type {
  AgentDecision,
  AgentDetail,
  AgentEngine,
  AgentLeaderboardRow,
  AgentPosition,
  AgentPromptVersion,
  AgentStatus,
  AgentTimeframe,
  AgentTokenUsageSummary,
  AgentTrade,
  ComparisonData,
  StrategyArchetype,
  SymbolAgentActivity,
  SymbolAgentPosition,
  SymbolAgentTrade,
} from "@/lib/types";

/**
 * Fetch all 28 agents with leaderboard metrics.
 *
 * Includes PnL, win rate, trade count, token cost, and open positions.
 * Ordered by total PnL descending (best performers first).
 */
export function getAgentLeaderboard(): Promise<AgentLeaderboardRow[]> {
  return cached("agents:leaderboard", 60, async () => {
    const rows = await sql`
      SELECT
        a.id,
        a.name,
        a.display_name,
        a.strategy_archetype,
        a.timeframe,
        a.engine,
        a.scan_model,
        a.trade_model,
        a.evolution_model,
        a.status,
        a.initial_balance,
        p.cash_balance,
        p.total_equity,
        p.total_realized_pnl,
        p.total_fees_paid,
        (p.total_equity - a.initial_balance) as total_pnl,
        (SELECT COUNT(*) FROM agent_trades WHERE agent_id = a.id) as trade_count,
        (SELECT COUNT(*) FILTER (WHERE pnl > 0) FROM agent_trades WHERE agent_id = a.id) as wins,
        (
          SELECT COALESCE(SUM(estimated_cost_usd), 0)
          FROM agent_token_usage WHERE agent_id = a.id
        ) as total_token_cost,
        (SELECT COUNT(*) FROM agent_positions WHERE agent_id = a.id) as open_positions
      FROM agents a
      JOIN agent_portfolios p ON a.id = p.agent_id
      ORDER BY (p.total_equity - a.initial_balance) DESC
    `;

    // Fetch health data separately — column may not exist until migration 008 runs
    const healthMap = new Map<number, string | null>();
    try {
      const healthRows = await sql`SELECT id, last_cycle_at FROM agents`;
      for (const r of healthRows) {
        healthMap.set(
          Number(r.id),
          r.last_cycle_at ? (r.last_cycle_at as Date).toISOString() : null
        );
      }
    } catch {
      // Column doesn't exist yet — all agents show as "never processed"
    }

    return rows.map((row) => {
      const tradeCount = Number(row.trade_count);
      const wins = Number(row.wins);

      return {
        id: Number(row.id),
        name: row.name as string,
        displayName: row.display_name as string,
        strategyArchetype: row.strategy_archetype as StrategyArchetype,
        timeframe: row.timeframe as AgentTimeframe,
        engine: (row.engine as AgentEngine) || "llm",
        scanModel: row.scan_model as string,
        tradeModel: row.trade_model as string,
        evolutionModel: row.evolution_model as string,
        status: row.status as AgentStatus,
        initialBalance: Number(row.initial_balance),
        cashBalance: Number(row.cash_balance),
        totalEquity: Number(row.total_equity),
        totalRealizedPnl: Number(row.total_realized_pnl),
        totalFeesPaid: Number(row.total_fees_paid),
        totalPnl: Number(row.total_pnl),
        tradeCount,
        wins,
        winRate: tradeCount > 0 ? wins / tradeCount : 0,
        totalTokenCost: Number(row.total_token_cost),
        openPositions: Number(row.open_positions),
        lastCycleAt: healthMap.get(Number(row.id)) ?? null,
      };
    });
  });
}

/**
 * Fetch a single agent with full detail.
 */
export async function getAgentDetail(
  agentId: number
): Promise<AgentDetail | null> {
  const rows = await sql`
    SELECT
      a.id,
      a.name,
      a.display_name,
      a.strategy_archetype,
      a.timeframe,
      a.engine,
      a.scan_model,
      a.trade_model,
      a.evolution_model,
      a.status,
      a.initial_balance,
      a.created_at,
      p.cash_balance,
      p.total_equity,
      p.total_realized_pnl,
      p.total_fees_paid,
      (p.total_equity - a.initial_balance) as total_pnl,
      (SELECT COUNT(*) FROM agent_trades WHERE agent_id = a.id) as trade_count,
      (SELECT COUNT(*) FILTER (WHERE pnl > 0) FROM agent_trades WHERE agent_id = a.id) as wins,
      (
        SELECT COALESCE(SUM(estimated_cost_usd), 0)
        FROM agent_token_usage WHERE agent_id = a.id
      ) as total_token_cost,
      (SELECT COUNT(*) FROM agent_positions WHERE agent_id = a.id) as open_positions
    FROM agents a
    JOIN agent_portfolios p ON a.id = p.agent_id
    WHERE a.id = ${agentId}
  `;

  if (rows.length === 0) return null;

  // Fetch health data separately — column may not exist until migration 008 runs
  let lastCycleAt: string | null = null;
  try {
    const healthRows = await sql`SELECT last_cycle_at FROM agents WHERE id = ${agentId}`;
    if (healthRows.length > 0 && healthRows[0].last_cycle_at) {
      lastCycleAt = (healthRows[0].last_cycle_at as Date).toISOString();
    }
  } catch {
    // Column doesn't exist yet
  }

  const row = rows[0];
  const tradeCount = Number(row.trade_count);
  const wins = Number(row.wins);

  return {
    id: Number(row.id),
    name: row.name as string,
    displayName: row.display_name as string,
    strategyArchetype: row.strategy_archetype as StrategyArchetype,
    timeframe: row.timeframe as AgentTimeframe,
    engine: (row.engine as AgentEngine) || "llm",
    scanModel: row.scan_model as string,
    tradeModel: row.trade_model as string,
    evolutionModel: row.evolution_model as string,
    status: row.status as AgentStatus,
    initialBalance: Number(row.initial_balance),
    cashBalance: Number(row.cash_balance),
    totalEquity: Number(row.total_equity),
    totalRealizedPnl: Number(row.total_realized_pnl),
    totalFeesPaid: Number(row.total_fees_paid),
    totalPnl: Number(row.total_pnl),
    tradeCount,
    wins,
    winRate: tradeCount > 0 ? wins / tradeCount : 0,
    totalTokenCost: Number(row.total_token_cost),
    openPositions: Number(row.open_positions),
    lastCycleAt,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

/**
 * Fetch trade history for an agent (most recent first).
 */
export async function getAgentTrades(
  agentId: number
): Promise<AgentTrade[]> {
  const rows = await sql`
    SELECT
      t.id,
      t.agent_id,
      sym.symbol,
      t.direction,
      t.entry_price,
      t.exit_price,
      t.position_size,
      t.pnl,
      t.fees,
      t.exit_reason,
      t.opened_at,
      t.closed_at,
      t.duration_minutes,
      d.reasoning_summary
    FROM agent_trades t
    JOIN symbols sym ON sym.id = t.symbol_id
    LEFT JOIN agent_decisions d ON d.id = t.decision_id
    WHERE t.agent_id = ${agentId}
    ORDER BY t.closed_at DESC
    LIMIT 200
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    agentId: Number(row.agent_id),
    symbol: row.symbol as string,
    direction: row.direction as "long" | "short",
    entryPrice: Number(row.entry_price),
    exitPrice: Number(row.exit_price),
    positionSize: Number(row.position_size),
    pnl: Number(row.pnl),
    fees: Number(row.fees),
    exitReason: row.exit_reason as AgentTrade["exitReason"],
    openedAt: (row.opened_at as Date).toISOString(),
    closedAt: (row.closed_at as Date).toISOString(),
    durationMinutes: Number(row.duration_minutes),
    reasoningSummary: (row.reasoning_summary as string) || null,
  }));
}

/**
 * Fetch decisions for an agent (most recent first).
 */
export async function getAgentDecisions(
  agentId: number
): Promise<AgentDecision[]> {
  const rows = await sql`
    SELECT
      d.id,
      d.agent_id,
      d.action,
      sym.symbol,
      d.reasoning_full,
      d.reasoning_summary,
      d.action_params,
      d.model_used,
      d.input_tokens,
      d.output_tokens,
      d.estimated_cost_usd,
      d.prompt_version,
      d.decided_at
    FROM agent_decisions d
    LEFT JOIN symbols sym ON sym.id = d.symbol_id
    WHERE d.agent_id = ${agentId}
    ORDER BY d.decided_at DESC
    LIMIT 200
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    agentId: Number(row.agent_id),
    action: row.action as string,
    symbol: (row.symbol as string) || null,
    reasoningFull: row.reasoning_full as string,
    reasoningSummary: row.reasoning_summary as string,
    actionParams: (row.action_params as Record<string, unknown>) || null,
    modelUsed: row.model_used as string,
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    estimatedCostUsd: Number(row.estimated_cost_usd),
    promptVersion: Number(row.prompt_version),
    decidedAt: (row.decided_at as Date).toISOString(),
  }));
}

/**
 * Fetch prompt version history for an agent.
 */
export async function getAgentPromptHistory(
  agentId: number
): Promise<AgentPromptVersion[]> {
  const rows = await sql`
    SELECT
      id,
      agent_id,
      version,
      system_prompt,
      source,
      diff_from_previous,
      performance_at_change,
      created_at,
      is_active
    FROM agent_prompts
    WHERE agent_id = ${agentId}
    ORDER BY version DESC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    agentId: Number(row.agent_id),
    version: Number(row.version),
    systemPrompt: row.system_prompt as string,
    source: row.source as AgentPromptVersion["source"],
    diffFromPrevious: (row.diff_from_previous as string) || null,
    performanceAtChange:
      (row.performance_at_change as AgentPromptVersion["performanceAtChange"]) ||
      null,
    createdAt: (row.created_at as Date).toISOString(),
    isActive: row.is_active as boolean,
  }));
}

/**
 * Fetch open positions for an agent.
 */
export async function getAgentOpenPositions(
  agentId: number
): Promise<AgentPosition[]> {
  const rows = await sql`
    SELECT
      pos.id,
      pos.agent_id,
      sym.symbol,
      pos.direction,
      pos.entry_price,
      pos.position_size,
      pos.stop_loss,
      pos.take_profit,
      pos.opened_at,
      pos.unrealized_pnl
    FROM agent_positions pos
    JOIN symbols sym ON sym.id = pos.symbol_id
    WHERE pos.agent_id = ${agentId}
    ORDER BY pos.opened_at DESC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    agentId: Number(row.agent_id),
    symbol: row.symbol as string,
    direction: row.direction as "long" | "short",
    entryPrice: Number(row.entry_price),
    positionSize: Number(row.position_size),
    stopLoss: row.stop_loss ? Number(row.stop_loss) : null,
    takeProfit: row.take_profit ? Number(row.take_profit) : null,
    openedAt: (row.opened_at as Date).toISOString(),
    unrealizedPnl: Number(row.unrealized_pnl),
  }));
}

/**
 * Fetch aggregated token usage for an agent.
 */
export async function getAgentTokenUsage(
  agentId: number
): Promise<AgentTokenUsageSummary[]> {
  const rows = await sql`
    SELECT
      model,
      task_type,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(estimated_cost_usd) as estimated_cost_usd
    FROM agent_token_usage
    WHERE agent_id = ${agentId}
    GROUP BY model, task_type
    ORDER BY model, task_type
  `;

  return rows.map((row) => ({
    model: row.model as string,
    taskType: row.task_type as AgentTokenUsageSummary["taskType"],
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    estimatedCostUsd: Number(row.estimated_cost_usd),
  }));
}

/**
 * Save a new prompt version (human edit).
 */
export async function saveAgentPrompt(
  agentId: number,
  systemPrompt: string
): Promise<number> {
  // Get current active prompt
  const current = await sql`
    SELECT version, system_prompt FROM agent_prompts
    WHERE agent_id = ${agentId} AND is_active = true
  `;

  if (current.length === 0) {
    throw new Error("Agent not found");
  }

  const newVersion = Number(current[0].version) + 1;
  const oldPrompt = current[0].system_prompt as string;

  // Simple diff: just note it was changed
  const diff = oldPrompt === systemPrompt
    ? null
    : `Human edit: prompt updated (v${newVersion})`;

  // Get performance snapshot
  const perfRows = await sql`
    SELECT
      p.total_realized_pnl as pnl,
      (SELECT COUNT(*) FROM agent_trades WHERE agent_id = ${agentId}) as trades
    FROM agent_portfolios p WHERE p.agent_id = ${agentId}
  `;
  const perf = perfRows.length > 0
    ? { pnl: Number(perfRows[0].pnl), trades: Number(perfRows[0].trades) }
    : null;

  // Deactivate current, insert new
  await sql`UPDATE agent_prompts SET is_active = false WHERE agent_id = ${agentId} AND is_active = true`;
  await sql`
    INSERT INTO agent_prompts (agent_id, version, system_prompt, source, diff_from_previous, performance_at_change, is_active)
    VALUES (${agentId}, ${newVersion}, ${systemPrompt}, 'human', ${diff}, ${JSON.stringify(perf)}, true)
  `;

  return newVersion;
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
  const rows = await sql`
    UPDATE agents
    SET scan_model = ${scanModel}, trade_model = ${tradeModel}, evolution_model = ${evolutionModel}
    WHERE id = ${agentId}
    RETURNING id
  `;

  if (rows.length === 0) {
    throw new Error("Agent not found");
  }
}

/**
 * Pause all LLM-engine agents that are currently active.
 * Returns the count of agents that were paused.
 */
export async function pauseAllLlmAgents(): Promise<number> {
  const rows = await sql`
    UPDATE agents
    SET status = 'paused'
    WHERE engine = 'llm' AND status = 'active'
    RETURNING id
  `;
  return rows.length;
}

/**
 * Fetch comparison data for multiple agents (max 4).
 * Fetches detail + trades in parallel for each agent.
 */
export async function getComparisonData(
  ids: number[]
): Promise<ComparisonData | null> {
  const clamped = ids.slice(0, 4);
  const results = await Promise.all(
    clamped.map(async (id) => {
      const [agent, trades] = await Promise.all([
        getAgentDetail(id),
        getAgentTrades(id),
      ]);
      return { agent, trades };
    })
  );

  const agents = results
    .map((r) => r.agent)
    .filter((a): a is AgentDetail => a !== null);

  if (agents.length < 2) return null;

  const trades: Record<number, AgentTrade[]> = {};
  for (const r of results) {
    if (r.agent) {
      trades[r.agent.id] = r.trades;
    }
  }

  return { agents, trades };
}

/**
 * Fetch agent activity for a symbol (open positions + recent trades across all agents).
 */
export async function getSymbolAgentActivity(
  symbol: string
): Promise<SymbolAgentActivity> {
  const pattern = `${symbol}%`;
  const [positionRows, tradeRows] = await Promise.all([
    sql`
      SELECT
        a.id as agent_id,
        a.display_name,
        a.strategy_archetype,
        a.timeframe,
        pos.direction,
        pos.entry_price,
        pos.position_size,
        pos.unrealized_pnl,
        pos.opened_at
      FROM agent_positions pos
      JOIN symbols sym ON sym.id = pos.symbol_id
      JOIN agents a ON a.id = pos.agent_id
      WHERE sym.symbol LIKE ${pattern}
      ORDER BY pos.opened_at DESC
    `,
    sql`
      SELECT
        a.id as agent_id,
        a.display_name,
        a.strategy_archetype,
        a.timeframe,
        t.direction,
        t.entry_price,
        t.exit_price,
        t.pnl,
        t.fees,
        t.closed_at
      FROM agent_trades t
      JOIN symbols sym ON sym.id = t.symbol_id
      JOIN agents a ON a.id = t.agent_id
      WHERE sym.symbol LIKE ${pattern}
      ORDER BY t.closed_at DESC
      LIMIT 50
    `,
  ]);

  const positions: SymbolAgentPosition[] = positionRows.map((row) => ({
    agentId: Number(row.agent_id),
    agentDisplayName: row.display_name as string,
    archetype: row.strategy_archetype as StrategyArchetype,
    timeframe: row.timeframe as AgentTimeframe,
    direction: row.direction as "long" | "short",
    entryPrice: Number(row.entry_price),
    positionSize: Number(row.position_size),
    unrealizedPnl: Number(row.unrealized_pnl),
    openedAt: (row.opened_at as Date).toISOString(),
  }));

  const trades: SymbolAgentTrade[] = tradeRows.map((row) => ({
    agentId: Number(row.agent_id),
    agentDisplayName: row.display_name as string,
    archetype: row.strategy_archetype as StrategyArchetype,
    timeframe: row.timeframe as AgentTimeframe,
    direction: row.direction as "long" | "short",
    entryPrice: Number(row.entry_price),
    exitPrice: Number(row.exit_price),
    pnl: Number(row.pnl),
    fees: Number(row.fees),
    closedAt: (row.closed_at as Date).toISOString(),
  }));

  const positionAgentIds = new Set(positions.map((p) => p.agentId));
  const tradeAgentIds = new Set(trades.map((t) => t.agentId));
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0).length;

  return {
    positions,
    trades,
    summary: {
      agentsWithPositions: positionAgentIds.size,
      agentsThatTraded: tradeAgentIds.size,
      totalTrades: trades.length,
      totalPnl,
      winRate: trades.length > 0 ? wins / trades.length : 0,
    },
  };
}

/**
 * Toggle an agent's status between active and paused.
 */
export async function toggleAgentStatus(
  agentId: number
): Promise<AgentStatus> {
  const rows = await sql`
    UPDATE agents
    SET status = CASE WHEN status = 'active' THEN 'paused' ELSE 'active' END
    WHERE id = ${agentId}
    RETURNING status
  `;

  if (rows.length === 0) {
    throw new Error(`Agent ${agentId} not found`);
  }

  return rows[0].status as AgentStatus;
}
