/**
 * Analytics Page — Fleet-wide performance dashboard.
 *
 * Server component with ISR 60s. Fetches all analytics data in parallel
 * and passes to the client-side tabbed dashboard.
 */

import {
  getAnalyticsSummary,
  getArchetypeStats,
  getTimeframeStats,
  getDailyPnl,
  getDailyArchetypePnl,
  getSymbolStats,
  getDailyTokenCost,
  getModelCostBreakdown,
  getArchetypeCost,
  getAgentDrawdowns,
} from "@/lib/queries/analytics";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export const revalidate = 60;

export default async function AnalyticsPage() {
  const [
    summary,
    archetypeStats,
    timeframeStats,
    dailyPnl,
    dailyArchetypePnl,
    symbolStats,
    dailyTokenCost,
    modelCosts,
    archetypeCosts,
    agentDrawdowns,
  ] = await Promise.all([
    getAnalyticsSummary(),
    getArchetypeStats(),
    getTimeframeStats(),
    getDailyPnl(),
    getDailyArchetypePnl(),
    getSymbolStats(),
    getDailyTokenCost(),
    getModelCostBreakdown(),
    getArchetypeCost(),
    getAgentDrawdowns(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Fleet-wide performance across all 28 agents
        </p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-muted">
        SIMULATED TRADING — All balances and trades are virtual. Not financial advice.
      </div>

      {/* Dashboard */}
      <AnalyticsDashboard
        summary={summary}
        archetypeStats={archetypeStats}
        timeframeStats={timeframeStats}
        dailyPnl={dailyPnl}
        dailyArchetypePnl={dailyArchetypePnl}
        symbolStats={symbolStats}
        dailyTokenCost={dailyTokenCost}
        modelCosts={modelCosts}
        archetypeCosts={archetypeCosts}
        agentDrawdowns={agentDrawdowns}
      />
    </div>
  );
}
