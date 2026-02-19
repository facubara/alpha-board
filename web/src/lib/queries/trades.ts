/**
 * Trade Queries
 *
 * Fetches recent trades (closed + open positions) for the live trade sidebar.
 */

import { sql } from "@/lib/db";
import type { TradeNotification } from "@/lib/types";

/**
 * Fetch recent trades: last N closed trades + all open positions.
 * Joins agents for display name and agent_decisions for reasoning_summary.
 */
export async function getRecentTrades(
  limit: number = 50
): Promise<TradeNotification[]> {
  const [closedRows, openRows] = await Promise.all([
    sql`
      SELECT
        t.id,
        a.display_name as agent_name,
        a.id as agent_id,
        COALESCE(a.uuid::text, '') as agent_uuid,
        a.engine,
        sym.symbol,
        t.direction,
        t.entry_price,
        t.exit_price,
        t.position_size,
        t.pnl,
        CASE WHEN t.position_size > 0 THEN (t.pnl / t.position_size * 100) ELSE 0 END as pnl_pct,
        t.exit_reason,
        t.duration_minutes,
        t.closed_at as timestamp,
        COALESCE(cd.reasoning_summary, od.reasoning_summary) as reasoning_summary
      FROM agent_trades t
      JOIN agents a ON a.id = t.agent_id
      JOIN symbols sym ON sym.id = t.symbol_id
      LEFT JOIN agent_decisions cd ON cd.id = t.close_decision_id
      LEFT JOIN agent_decisions od ON od.id = t.decision_id
      ORDER BY t.closed_at DESC
      LIMIT ${limit}
    `,
    sql`
      SELECT
        pos.id,
        a.display_name as agent_name,
        a.id as agent_id,
        COALESCE(a.uuid::text, '') as agent_uuid,
        a.engine,
        sym.symbol,
        pos.direction,
        pos.entry_price,
        pos.position_size,
        pos.stop_loss,
        pos.take_profit,
        pos.opened_at as timestamp
      FROM agent_positions pos
      JOIN agents a ON a.id = pos.agent_id
      JOIN symbols sym ON sym.id = pos.symbol_id
      ORDER BY pos.opened_at DESC
    `,
  ]);

  const closed: TradeNotification[] = closedRows.map((row) => ({
    id: `closed-${row.id}`,
    type: "trade_closed" as const,
    agentName: row.agent_name as string,
    agentId: Number(row.agent_id),
    agentUuid: row.agent_uuid as string,
    engine: (row.engine as TradeNotification["engine"]) || "llm",
    symbol: row.symbol as string,
    direction: row.direction as "long" | "short",
    entryPrice: Number(row.entry_price),
    exitPrice: Number(row.exit_price),
    positionSize: Number(row.position_size),
    pnl: Number(row.pnl),
    pnlPct: Number(row.pnl_pct),
    exitReason: row.exit_reason as string,
    durationMinutes: Number(row.duration_minutes),
    stopLoss: null,
    takeProfit: null,
    confidence: null,
    reasoningSummary: (row.reasoning_summary as string) || null,
    timestamp: (row.timestamp as Date).toISOString(),
    isRead: true,
  }));

  const open: TradeNotification[] = openRows.map((row) => ({
    id: `open-${row.id}`,
    type: "trade_opened" as const,
    agentName: row.agent_name as string,
    agentId: Number(row.agent_id),
    agentUuid: row.agent_uuid as string,
    engine: (row.engine as TradeNotification["engine"]) || "llm",
    symbol: row.symbol as string,
    direction: row.direction as "long" | "short",
    entryPrice: Number(row.entry_price),
    exitPrice: null,
    positionSize: Number(row.position_size),
    pnl: null,
    pnlPct: null,
    exitReason: null,
    durationMinutes: null,
    stopLoss: row.stop_loss ? Number(row.stop_loss) : null,
    takeProfit: row.take_profit ? Number(row.take_profit) : null,
    confidence: null,
    reasoningSummary: null,
    timestamp: (row.timestamp as Date).toISOString(),
    isRead: true,
  }));

  // Merge and sort by timestamp descending
  return [...open, ...closed].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
