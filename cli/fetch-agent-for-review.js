/**
 * Fetch agent data for performance review.
 *
 * Usage: node cli/fetch-agent-for-review.js [--agent-id N]
 * Output: JSON to stdout with full agent context for analysis.
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
      SELECT a.* FROM agents a WHERE a.id = ${agentId}
    `;
    agentRow = rows[0];
  } else {
    // Fetch next active agent not reviewed in last 7 days
    const rows = await sql`
      SELECT a.*
      FROM agents a
      WHERE a.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM agent_analysis_history h
          WHERE h.agent_id = a.id
            AND h.created_at > NOW() - INTERVAL '7 days'
        )
      ORDER BY a.id ASC
      LIMIT 1
    `;
    agentRow = rows[0];
  }

  if (!agentRow) {
    console.log(JSON.stringify({ agent: null, message: "No agents pending review" }));
    process.exit(0);
  }

  const id = Number(agentRow.id);

  // Fetch related data in parallel
  const [portfolioRows, tradeRows, decisionRows, memoryRows, promptRows] =
    await Promise.all([
      sql`
        SELECT * FROM agent_portfolios WHERE agent_id = ${id}
      `,
      sql`
        SELECT at.*, s.name AS symbol_name
        FROM agent_trades at
        JOIN symbols s ON s.id = at.symbol_id
        WHERE at.agent_id = ${id}
        ORDER BY at.closed_at DESC
        LIMIT 20
      `,
      sql`
        SELECT * FROM agent_decisions
        WHERE agent_id = ${id}
        ORDER BY decided_at DESC
        LIMIT 20
      `,
      sql`
        SELECT * FROM agent_memory
        WHERE agent_id = ${id}
        ORDER BY created_at DESC
        LIMIT 10
      `,
      sql`
        SELECT * FROM agent_prompts
        WHERE agent_id = ${id} AND is_active = true
        LIMIT 1
      `,
    ]);

  const portfolio = portfolioRows[0] || null;
  const activePrompt = promptRows[0] || null;

  // Calculate performance metrics
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
    status: agentRow.status,
    currentPrompt: activePrompt?.prompt_text || null,
    portfolio: portfolio
      ? {
          cash: Number(portfolio.cash),
          totalEquity: Number(portfolio.total_equity),
        }
      : null,
    recentTrades: tradeRows.map((t) => ({
      id: Number(t.id),
      symbol: t.symbol_name,
      direction: t.direction,
      entryPrice: Number(t.entry_price),
      exitPrice: t.exit_price ? Number(t.exit_price) : null,
      pnl: Number(t.pnl),
      exitReason: t.exit_reason,
      closedAt: t.closed_at,
    })),
    recentDecisions: decisionRows.map((d) => ({
      id: Number(d.id),
      action: d.action,
      symbol: d.symbol,
      reasoning: d.reasoning_summary,
      decidedAt: d.decided_at,
    })),
    memories: memoryRows.map((m) => ({
      id: Number(m.id),
      lesson: m.lesson,
      tags: m.tags || [],
      createdAt: m.created_at,
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
