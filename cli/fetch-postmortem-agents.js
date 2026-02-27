/**
 * Fetch discarded agents that don't have fleet_lessons for post-mortem analysis.
 *
 * Usage: node cli/fetch-postmortem-agents.js [--agent-id N]
 * Output: JSON to stdout with agent details, trades, and memories.
 */

import { sql } from "./db.js";

const args = process.argv.slice(2);
const agentId = args.includes("--agent-id")
  ? Number(args[args.indexOf("--agent-id") + 1])
  : null;

try {
  let agentRow;

  if (agentId) {
    const rows = await sql`
      SELECT a.* FROM agents a WHERE a.id = ${agentId} AND a.status = 'discarded'
    `;
    agentRow = rows[0];
  } else {
    const rows = await sql`
      SELECT a.*
      FROM agents a
      WHERE a.status = 'discarded'
        AND NOT EXISTS (
          SELECT 1 FROM fleet_lessons l WHERE l.agent_id = a.id
        )
      ORDER BY a.discarded_at DESC NULLS LAST
      LIMIT 1
    `;
    agentRow = rows[0];
  }

  if (!agentRow) {
    console.log(JSON.stringify({ agent: null, message: "No agents pending post-mortem" }));
    process.exit(0);
  }

  const id = Number(agentRow.id);

  const [tradeRows, memoryRows, promptRows] = await Promise.all([
    sql`
      SELECT at.*, s.name AS symbol_name
      FROM agent_trades at
      JOIN symbols s ON s.id = at.symbol_id
      WHERE at.agent_id = ${id}
      ORDER BY at.closed_at DESC
      LIMIT 30
    `,
    sql`
      SELECT * FROM agent_memory
      WHERE agent_id = ${id}
      ORDER BY created_at DESC
    `,
    sql`
      SELECT * FROM agent_prompts
      WHERE agent_id = ${id}
      ORDER BY version DESC
      LIMIT 3
    `,
  ]);

  const totalTrades = tradeRows.length;
  const wins = tradeRows.filter((t) => Number(t.pnl) > 0).length;
  const totalPnl = tradeRows.reduce((sum, t) => sum + Number(t.pnl), 0);

  const agent = {
    id,
    name: agentRow.name,
    displayName: agentRow.display_name,
    archetype: agentRow.strategy_archetype,
    timeframe: agentRow.timeframe,
    engine: agentRow.engine,
    source: agentRow.source,
    discardReason: agentRow.discard_reason,
    discardedAt: agentRow.discarded_at,
    trades: tradeRows.map((t) => ({
      symbol: t.symbol_name,
      direction: t.direction,
      pnl: Number(t.pnl),
      exitReason: t.exit_reason,
      closedAt: t.closed_at,
    })),
    memories: memoryRows.map((m) => ({
      lesson: m.lesson,
      tags: m.tags || [],
    })),
    promptHistory: promptRows.map((p) => ({
      version: Number(p.version),
      promptText: p.prompt_text,
    })),
    performance: {
      totalTrades,
      winRate: totalTrades > 0 ? wins / totalTrades : 0,
      totalPnl: totalPnl.toFixed(2),
    },
  };

  console.log(JSON.stringify({ agent }, null, 2));
} catch (err) {
  console.error("Error fetching agent:", err.message);
  process.exit(1);
}
