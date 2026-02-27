/**
 * Analytics Page — Fleet-wide performance dashboard.
 *
 * Server component with ISR 60s. Fetches all analytics data in parallel
 * and passes to the client-side tabbed dashboard.
 */

import Link from "next/link";
import {
  getAnalyticsSummary,
  getArchetypeStats,
  getSourceStats,
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

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [
    summary,
    archetypeStats,
    sourceStats,
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
    getSourceStats(),
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
        <h1 className="text-2xl font-bold tracking-tight text-primary">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Fleet-wide performance across all agents
        </p>
      </div>

      {/* Context banner */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
        <p className="text-sm text-secondary">
          Fleet overview — aggregate stats across all agents, including experimental strategies. Individual performance varies.{" "}
          <Link href="/agents" className="text-[var(--accent-blue)] hover:underline">
            View top performers &rarr;
          </Link>
        </p>
        <p className="mt-1 text-xs text-muted">
          SIMULATED TRADING — All balances and trades are virtual. Not financial advice.
        </p>
      </div>

      {/* Dashboard */}
      <div className="border-t border-[var(--border-default)] pt-6">
      <AnalyticsDashboard
        summary={summary}
        archetypeStats={archetypeStats}
        sourceStats={sourceStats}
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
    </div>
  );
}
