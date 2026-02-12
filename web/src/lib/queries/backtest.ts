/**
 * Backtest Queries
 *
 * Fetches backtest data from Neon database.
 */

import { sql } from "@/lib/db";
import type { BacktestRun, BacktestTrade } from "@/lib/types";

/**
 * Fetch all backtest runs, most recent first.
 */
export async function getBacktestRuns(): Promise<BacktestRun[]> {
  const rows = await sql`
    SELECT
      id,
      agent_name,
      strategy_archetype,
      timeframe,
      symbol,
      start_date,
      end_date,
      initial_balance,
      final_equity,
      total_pnl,
      total_trades,
      winning_trades,
      max_drawdown_pct,
      sharpe_ratio,
      status,
      error_message,
      started_at,
      completed_at
    FROM backtest_runs
    ORDER BY started_at DESC
    LIMIT 50
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    agentName: row.agent_name as string,
    strategyArchetype: row.strategy_archetype as string,
    timeframe: row.timeframe as string,
    symbol: row.symbol as string,
    startDate: (row.start_date as Date).toISOString(),
    endDate: (row.end_date as Date).toISOString(),
    initialBalance: Number(row.initial_balance),
    finalEquity: row.final_equity != null ? Number(row.final_equity) : null,
    totalPnl: row.total_pnl != null ? Number(row.total_pnl) : null,
    totalTrades: Number(row.total_trades ?? 0),
    winningTrades: Number(row.winning_trades ?? 0),
    maxDrawdownPct:
      row.max_drawdown_pct != null ? Number(row.max_drawdown_pct) : null,
    sharpeRatio: row.sharpe_ratio != null ? Number(row.sharpe_ratio) : null,
    equityCurve: null, // Not fetched in list view
    status: row.status as BacktestRun["status"],
    errorMessage: (row.error_message as string) || null,
    startedAt: (row.started_at as Date).toISOString(),
    completedAt: row.completed_at
      ? (row.completed_at as Date).toISOString()
      : null,
  }));
}

/**
 * Fetch a single backtest run with trades and equity curve.
 */
export async function getBacktestRun(
  runId: number
): Promise<{ run: BacktestRun; trades: BacktestTrade[] } | null> {
  const runRows = await sql`
    SELECT
      id,
      agent_name,
      strategy_archetype,
      timeframe,
      symbol,
      start_date,
      end_date,
      initial_balance,
      final_equity,
      total_pnl,
      total_trades,
      winning_trades,
      max_drawdown_pct,
      sharpe_ratio,
      equity_curve,
      status,
      error_message,
      started_at,
      completed_at
    FROM backtest_runs
    WHERE id = ${runId}
  `;

  if (runRows.length === 0) return null;

  const row = runRows[0];
  const run: BacktestRun = {
    id: Number(row.id),
    agentName: row.agent_name as string,
    strategyArchetype: row.strategy_archetype as string,
    timeframe: row.timeframe as string,
    symbol: row.symbol as string,
    startDate: (row.start_date as Date).toISOString(),
    endDate: (row.end_date as Date).toISOString(),
    initialBalance: Number(row.initial_balance),
    finalEquity: row.final_equity != null ? Number(row.final_equity) : null,
    totalPnl: row.total_pnl != null ? Number(row.total_pnl) : null,
    totalTrades: Number(row.total_trades ?? 0),
    winningTrades: Number(row.winning_trades ?? 0),
    maxDrawdownPct:
      row.max_drawdown_pct != null ? Number(row.max_drawdown_pct) : null,
    sharpeRatio: row.sharpe_ratio != null ? Number(row.sharpe_ratio) : null,
    equityCurve:
      (row.equity_curve as BacktestRun["equityCurve"]) || null,
    status: row.status as BacktestRun["status"],
    errorMessage: (row.error_message as string) || null,
    startedAt: (row.started_at as Date).toISOString(),
    completedAt: row.completed_at
      ? (row.completed_at as Date).toISOString()
      : null,
  };

  const tradeRows = await sql`
    SELECT
      id,
      symbol,
      direction,
      entry_price,
      exit_price,
      position_size,
      pnl,
      fees,
      exit_reason,
      entry_at,
      exit_at,
      duration_minutes
    FROM backtest_trades
    WHERE run_id = ${runId}
    ORDER BY entry_at ASC
  `;

  const trades: BacktestTrade[] = tradeRows.map((t) => ({
    id: Number(t.id),
    symbol: t.symbol as string,
    direction: t.direction as "long" | "short",
    entryPrice: Number(t.entry_price),
    exitPrice: Number(t.exit_price),
    positionSize: Number(t.position_size),
    pnl: Number(t.pnl),
    fees: Number(t.fees),
    exitReason: t.exit_reason as string,
    entryAt: (t.entry_at as Date).toISOString(),
    exitAt: (t.exit_at as Date).toISOString(),
    durationMinutes: Number(t.duration_minutes),
  }));

  return { run, trades };
}
