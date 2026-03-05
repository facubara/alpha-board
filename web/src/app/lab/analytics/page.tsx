/**
 * Analytics Page — Fleet-wide performance dashboard.
 *
 * Server component with ISR 120s. Fetches all analytics data in a single
 * consolidated request via /analytics/all.
 */

import Link from "next/link";
import { PageHeader } from "@/components/terminal";
import { getAllAnalytics } from "@/lib/queries/analytics";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export const revalidate = 120;

export default async function AnalyticsPage() {
  const data = await getAllAnalytics();

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
        summary={data.summary}
        archetypeStats={data.archetypeStats}
        sourceStats={data.sourceStats}
        timeframeStats={data.timeframeStats}
        dailyPnl={data.dailyPnl}
        dailyArchetypePnl={data.dailyArchetypePnl}
        symbolStats={data.symbolStats}
        dailyTokenCost={data.dailyTokenCost}
        modelCosts={data.modelCosts}
        archetypeCosts={data.archetypeCosts}
        agentDrawdowns={data.agentDrawdowns}
        directionStats={data.directionStats}
      />
      </div>
    </div>
  );
}
