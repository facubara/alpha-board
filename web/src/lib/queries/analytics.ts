/**
 * Analytics Queries
 *
 * Aggregate queries for the performance dashboard / analytics page.
 * All queries hit Neon directly — no worker endpoints needed.
 */

import { cached } from "@/lib/cache";
import { sql } from "@/lib/db";
import type {
  AnalyticsSummary,
  ArchetypeStats,
  TimeframeStats,
  DailyPnl,
  DailyArchetypePnl,
  SymbolStats,
  DailyTokenCost,
  ModelCostBreakdown,
  ArchetypeCost,
  AgentDrawdown,
  StrategyArchetype,
  AgentTimeframe,
} from "@/lib/types";

/**
 * Fleet-wide summary totals.
 */
export function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return cached("analytics:summary", 120, async () => {
    const rows = await sql`
      SELECT
        COALESCE(SUM(p.total_equity - a.initial_balance), 0) as total_pnl,
        COALESCE(SUM(a.initial_balance), 0) as total_initial_balance,
        COALESCE(SUM(p.total_fees_paid), 0) as total_fees,
        (SELECT COUNT(*) FROM agent_trades) as total_trades,
        (SELECT COUNT(*) FILTER (WHERE pnl > 0) FROM agent_trades) as total_wins,
        (SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM agent_token_usage) as total_token_cost
      FROM agents a
      JOIN agent_portfolios p ON a.id = p.agent_id
    `;

    // Compute max drawdown: worst individual agent drawdown percentage
    const ddRows = await sql`
      SELECT
        MIN(
          CASE WHEN a.initial_balance > 0
            THEN ((p.total_equity - a.initial_balance) / a.initial_balance) * 100
            ELSE 0
          END
        ) as max_drawdown_pct
      FROM agents a
      JOIN agent_portfolios p ON a.id = p.agent_id
    `;

    return {
      totalPnl: Number(rows[0].total_pnl),
      totalTrades: Number(rows[0].total_trades),
      totalWins: Number(rows[0].total_wins),
      totalFees: Number(rows[0].total_fees),
      totalTokenCost: Number(rows[0].total_token_cost),
      totalInitialBalance: Number(rows[0].total_initial_balance),
      maxDrawdownPct: Math.min(0, Number(ddRows[0].max_drawdown_pct)),
    };
  });
}

/**
 * Performance grouped by strategy archetype.
 */
export function getArchetypeStats(): Promise<ArchetypeStats[]> {
  return cached("analytics:archetype_stats", 120, async () => {
    const rows = await sql`
      SELECT
        a.strategy_archetype,
        COUNT(DISTINCT a.id) as agent_count,
        COALESCE(SUM(p.total_equity - a.initial_balance), 0) as total_pnl,
        COALESCE(SUM(sub.trade_count), 0) as trade_count,
        COALESCE(SUM(sub.wins), 0) as wins
      FROM agents a
      JOIN agent_portfolios p ON a.id = p.agent_id
      LEFT JOIN (
        SELECT
          agent_id,
          COUNT(*) as trade_count,
          COUNT(*) FILTER (WHERE pnl > 0) as wins
        FROM agent_trades
        GROUP BY agent_id
      ) sub ON sub.agent_id = a.id
      GROUP BY a.strategy_archetype
      ORDER BY total_pnl DESC
    `;

    return rows.map((r) => {
      const tradeCount = Number(r.trade_count);
      const wins = Number(r.wins);
      return {
        archetype: r.strategy_archetype as StrategyArchetype,
        agentCount: Number(r.agent_count),
        totalPnl: Number(r.total_pnl),
        tradeCount,
        wins,
        winRate: tradeCount > 0 ? wins / tradeCount : 0,
      };
    });
  });
}

/**
 * Performance grouped by timeframe.
 */
export function getTimeframeStats(): Promise<TimeframeStats[]> {
  return cached("analytics:timeframe_stats", 120, async () => {
    const rows = await sql`
      SELECT
        a.timeframe,
        COUNT(DISTINCT a.id) as agent_count,
        COALESCE(SUM(p.total_equity - a.initial_balance), 0) as total_pnl,
        COALESCE(SUM(sub.trade_count), 0) as trade_count,
        COALESCE(SUM(sub.wins), 0) as wins
      FROM agents a
      JOIN agent_portfolios p ON a.id = p.agent_id
      LEFT JOIN (
        SELECT
          agent_id,
          COUNT(*) as trade_count,
          COUNT(*) FILTER (WHERE pnl > 0) as wins
        FROM agent_trades
        GROUP BY agent_id
      ) sub ON sub.agent_id = a.id
      GROUP BY a.timeframe
      ORDER BY total_pnl DESC
    `;

    return rows.map((r) => {
      const tradeCount = Number(r.trade_count);
      const wins = Number(r.wins);
      return {
        timeframe: r.timeframe as AgentTimeframe,
        agentCount: Number(r.agent_count),
        totalPnl: Number(r.total_pnl),
        tradeCount,
        wins,
        winRate: tradeCount > 0 ? wins / tradeCount : 0,
      };
    });
  });
}

/**
 * Daily PnL time series with cumulative sum (90-day window).
 */
export function getDailyPnl(): Promise<DailyPnl[]> {
  return cached("analytics:daily_pnl", 120, async () => {
    const rows = await sql`
      SELECT
        DATE(closed_at) as day,
        SUM(pnl) as daily_pnl,
        COUNT(*) as trade_count,
        COUNT(*) FILTER (WHERE pnl > 0) as wins
      FROM agent_trades
      WHERE closed_at >= NOW() - INTERVAL '90 days'
      GROUP BY DATE(closed_at)
      ORDER BY day ASC
    `;

    let cumulative = 0;
    return rows.map((r) => {
      const dailyPnl = Number(r.daily_pnl);
      cumulative += dailyPnl;
      return {
        day: (r.day as Date).toISOString().split("T")[0],
        dailyPnl,
        cumulativePnl: cumulative,
        tradeCount: Number(r.trade_count),
        wins: Number(r.wins),
      };
    });
  });
}

/**
 * Daily PnL by archetype for multi-line chart (90-day window).
 */
export function getDailyArchetypePnl(): Promise<DailyArchetypePnl[]> {
  return cached("analytics:archetype_pnl", 120, async () => {
    const rows = await sql`
      SELECT
        DATE(t.closed_at) as day,
        a.strategy_archetype,
        SUM(t.pnl) as daily_pnl
      FROM agent_trades t
      JOIN agents a ON a.id = t.agent_id
      WHERE t.closed_at >= NOW() - INTERVAL '90 days'
      GROUP BY DATE(t.closed_at), a.strategy_archetype
      ORDER BY day ASC, a.strategy_archetype
    `;

    return rows.map((r) => ({
      day: (r.day as Date).toISOString().split("T")[0],
      archetype: r.strategy_archetype as StrategyArchetype,
      dailyPnl: Number(r.daily_pnl),
    }));
  });
}

/**
 * Per-symbol trade statistics (top 30 by trade count).
 */
export function getSymbolStats(): Promise<SymbolStats[]> {
  return cached("analytics:symbol_stats", 120, async () => {
    const rows = await sql`
      SELECT
        sym.symbol,
        COUNT(*) as trade_count,
        COUNT(*) FILTER (WHERE t.pnl > 0) as wins,
        SUM(t.pnl) as total_pnl,
        AVG(t.pnl) as avg_pnl,
        SUM(t.fees) as total_fees
      FROM agent_trades t
      JOIN symbols sym ON sym.id = t.symbol_id
      GROUP BY sym.symbol
      ORDER BY COUNT(*) DESC
      LIMIT 30
    `;

    return rows.map((r) => {
      const tradeCount = Number(r.trade_count);
      const wins = Number(r.wins);
      return {
        symbol: r.symbol as string,
        tradeCount,
        wins,
        winRate: tradeCount > 0 ? wins / tradeCount : 0,
        totalPnl: Number(r.total_pnl),
        avgPnl: Number(r.avg_pnl),
        totalFees: Number(r.total_fees),
      };
    });
  });
}

/**
 * Daily token cost time series (90-day window).
 */
export function getDailyTokenCost(): Promise<DailyTokenCost[]> {
  return cached("analytics:daily_costs", 120, async () => {
    const rows = await sql`
      SELECT
        date as day,
        SUM(estimated_cost_usd) as daily_cost,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens
      FROM agent_token_usage
      WHERE date >= NOW() - INTERVAL '90 days'
      GROUP BY date
      ORDER BY day ASC
    `;

    return rows.map((r) => ({
      day: (r.day as Date).toISOString().split("T")[0],
      dailyCost: Number(r.daily_cost),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
    }));
  });
}

/**
 * Token cost breakdown by model and task type.
 */
export function getModelCostBreakdown(): Promise<ModelCostBreakdown[]> {
  return cached("analytics:model_costs", 120, async () => {
    const rows = await sql`
      SELECT
        model,
        task_type,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(estimated_cost_usd) as total_cost
      FROM agent_token_usage
      GROUP BY model, task_type
      ORDER BY total_cost DESC
    `;

    return rows.map((r) => ({
      model: r.model as string,
      taskType: r.task_type as string,
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalCost: Number(r.total_cost),
    }));
  });
}

/**
 * Token cost aggregated by archetype.
 */
export function getArchetypeCost(): Promise<ArchetypeCost[]> {
  return cached("analytics:archetype_costs", 120, async () => {
    const rows = await sql`
      SELECT
        a.strategy_archetype,
        COALESCE(SUM(tu.estimated_cost_usd), 0) as total_cost,
        COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens
      FROM agents a
      LEFT JOIN agent_token_usage tu ON tu.agent_id = a.id
      GROUP BY a.strategy_archetype
      ORDER BY total_cost DESC
    `;

    return rows.map((r) => ({
      archetype: r.strategy_archetype as StrategyArchetype,
      totalCost: Number(r.total_cost),
      totalTokens: Number(r.total_tokens),
    }));
  });
}

/**
 * Agents currently in drawdown (equity below initial balance).
 */
export function getAgentDrawdowns(): Promise<AgentDrawdown[]> {
  return cached("analytics:drawdowns", 120, async () => {
    const rows = await sql`
      SELECT
        a.id,
        a.display_name,
        a.strategy_archetype,
        a.timeframe,
        GREATEST(p.peak_equity, a.initial_balance) as peak_equity,
        p.total_equity,
        CASE WHEN GREATEST(p.peak_equity, a.initial_balance) > 0
          THEN ((p.total_equity - GREATEST(p.peak_equity, a.initial_balance)) / GREATEST(p.peak_equity, a.initial_balance)) * 100
          ELSE 0
        END as drawdown_pct
      FROM agents a
      JOIN agent_portfolios p ON a.id = p.agent_id
      WHERE p.total_equity < GREATEST(p.peak_equity, a.initial_balance)
      ORDER BY drawdown_pct ASC
    `;

    return rows.map((r) => ({
      id: Number(r.id),
      displayName: r.display_name as string,
      archetype: r.strategy_archetype as StrategyArchetype,
      timeframe: r.timeframe as AgentTimeframe,
      peakEquity: Number(r.peak_equity),
      totalEquity: Number(r.total_equity),
      drawdownPct: Number(r.drawdown_pct),
    }));
  });
}
