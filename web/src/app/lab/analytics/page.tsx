/**
 * Analytics Page — Fleet-wide performance dashboard.
 *
 * Server component with ISR 60s. Fetches all analytics data in parallel
 * and passes to the client-side tabbed dashboard.
 */

import Link from "next/link";
import { PageHeader } from "@/components/terminal";
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
  getDirectionStats,
} from "@/lib/queries/analytics";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export const revalidate = 120;

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
    directionStats,
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
    getDirectionStats(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Fleet-wide performance across all agents" />

      {/* Context banner */}
      <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
        <p className="text-sm text-text-secondary">
          Fleet overview — aggregate stats across all agents, including experimental strategies. Individual performance varies.{" "}
          <Link href="/agents/marketplace" className="text-terminal-amber hover:underline">
            View top performers &rarr;
          </Link>
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          SIMULATED TRADING — All balances and trades are virtual. Not financial advice.
        </p>
      </div>

      {/* Dashboard */}
      <div className="border-t border-void-border pt-6">
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
        directionStats={directionStats}
      />
      </div>
    </div>
  );
}
