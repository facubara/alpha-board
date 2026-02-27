/**
 * Fetch closed trades that don't have agent_memory entries.
 *
 * Usage: node cli/fetch-unmemoed-trades.js [--limit N] [--after-id N]
 * Output: JSON to stdout with trades array and total_pending count.
 */

import { sql } from "./db.js";

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf("--limit") + 1]) || 10;
const afterId = args.includes("--after-id")
  ? Number(args[args.indexOf("--after-id") + 1])
  : null;

try {
  const countRows = await sql`
    SELECT COUNT(*) AS cnt
    FROM agent_trades t
    LEFT JOIN agent_memory m ON m.trade_id = t.id
    WHERE m.id IS NULL AND t.closed_at IS NOT NULL
  `;
  const totalPending = Number(countRows[0].cnt);

  let rows;
  if (afterId) {
    rows = await sql`
      SELECT
        t.id,
        t.agent_id,
        a.display_name AS agent_name,
        a.strategy_archetype AS archetype,
        s.name AS symbol,
        t.direction,
        t.entry_price,
        t.exit_price,
        t.position_size,
        t.pnl,
        t.fees,
        t.exit_reason,
        t.opened_at,
        t.closed_at,
        t.duration_minutes
      FROM agent_trades t
      JOIN agents a ON a.id = t.agent_id
      JOIN symbols s ON s.id = t.symbol_id
      LEFT JOIN agent_memory m ON m.trade_id = t.id
      WHERE m.id IS NULL AND t.closed_at IS NOT NULL AND t.id > ${afterId}
      ORDER BY t.id ASC
      LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT
        t.id,
        t.agent_id,
        a.display_name AS agent_name,
        a.strategy_archetype AS archetype,
        s.name AS symbol,
        t.direction,
        t.entry_price,
        t.exit_price,
        t.position_size,
        t.pnl,
        t.fees,
        t.exit_reason,
        t.opened_at,
        t.closed_at,
        t.duration_minutes
      FROM agent_trades t
      JOIN agents a ON a.id = t.agent_id
      JOIN symbols s ON s.id = t.symbol_id
      LEFT JOIN agent_memory m ON m.trade_id = t.id
      WHERE m.id IS NULL AND t.closed_at IS NOT NULL
      ORDER BY t.id ASC
      LIMIT ${limit}
    `;
  }

  const trades = rows.map((r) => ({
    id: Number(r.id),
    agentId: Number(r.agent_id),
    agentName: r.agent_name,
    archetype: r.archetype,
    symbol: r.symbol,
    direction: r.direction,
    entryPrice: Number(r.entry_price),
    exitPrice: r.exit_price ? Number(r.exit_price) : null,
    positionSize: Number(r.position_size),
    pnl: Number(r.pnl),
    fees: Number(r.fees),
    exitReason: r.exit_reason,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    durationMinutes: r.duration_minutes ? Number(r.duration_minutes) : null,
  }));

  console.log(JSON.stringify({ trades, total_pending: totalPending }, null, 2));
} catch (err) {
  console.error("Error fetching trades:", err.message);
  process.exit(1);
}
