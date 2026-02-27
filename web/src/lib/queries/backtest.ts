/**
 * Backtest Queries
 *
 * Fetches backtest data from the worker API.
 */

import { workerGet } from "@/lib/worker-client";
import type { BacktestRun, BacktestTrade } from "@/lib/types";

/**
 * Fetch all backtest runs, most recent first.
 */
export async function getBacktestRuns(): Promise<BacktestRun[]> {
  return workerGet<BacktestRun[]>("/backtest");
}

/**
 * Fetch a single backtest run with trades and equity curve.
 */
export async function getBacktestRun(
  runId: number
): Promise<{ run: BacktestRun; trades: BacktestTrade[] } | null> {
  try {
    const data = await workerGet<{
      id: number;
      agent_name: string;
      strategy_archetype: string;
      timeframe: string;
      symbol: string;
      start_date: string;
      end_date: string;
      initial_balance: number;
      final_equity: number | null;
      total_pnl: number | null;
      total_trades: number;
      winning_trades: number;
      max_drawdown_pct: number | null;
      sharpe_ratio: number | null;
      equity_curve: BacktestRun["equityCurve"];
      status: string;
      error_message: string | null;
      started_at: string;
      completed_at: string | null;
      trades: Array<{
        id: number;
        symbol: string;
        direction: string;
        entry_price: number;
        exit_price: number;
        position_size: number;
        pnl: number;
        fees: number;
        exit_reason: string;
        entry_at: string;
        exit_at: string;
        duration_minutes: number;
      }>;
    }>(`/backtest/${runId}`);

    const run: BacktestRun = {
      id: data.id,
      agentName: data.agent_name,
      strategyArchetype: data.strategy_archetype,
      timeframe: data.timeframe,
      symbol: data.symbol,
      startDate: data.start_date,
      endDate: data.end_date,
      initialBalance: data.initial_balance,
      finalEquity: data.final_equity,
      totalPnl: data.total_pnl,
      totalTrades: data.total_trades ?? 0,
      winningTrades: data.winning_trades ?? 0,
      maxDrawdownPct: data.max_drawdown_pct,
      sharpeRatio: data.sharpe_ratio,
      equityCurve: data.equity_curve || null,
      status: data.status as BacktestRun["status"],
      errorMessage: data.error_message || null,
      startedAt: data.started_at,
      completedAt: data.completed_at || null,
    };

    const trades: BacktestTrade[] = (data.trades || []).map((t) => ({
      id: t.id,
      symbol: t.symbol,
      direction: t.direction as "long" | "short",
      entryPrice: t.entry_price,
      exitPrice: t.exit_price,
      positionSize: t.position_size,
      pnl: t.pnl,
      fees: t.fees,
      exitReason: t.exit_reason,
      entryAt: t.entry_at,
      exitAt: t.exit_at,
      durationMinutes: t.duration_minutes,
    }));

    return { run, trades };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && e.status === 404) {
      return null;
    }
    throw e;
  }
}
