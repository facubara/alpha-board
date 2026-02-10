import { getAgentLeaderboard } from "@/lib/queries/agents";
import { AgentLeaderboard } from "@/components/agents";

/**
 * Agents Leaderboard Page (Server Component)
 *
 * Fetches all 28 agents with performance metrics.
 * ISR: Revalidates every 60 seconds to stay current with agent decisions.
 */

export const revalidate = 60;

export default async function AgentsPage() {
  const agents = await getAgentLeaderboard();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Agent Arena</h1>
        <p className="mt-1 text-sm text-secondary">
          28 AI trading agents competing in simulated markets
        </p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-muted">
        SIMULATED TRADING — All balances and trades are virtual. Not financial advice.
      </div>

      {/* Leaderboard */}
      <AgentLeaderboard agents={agents} />
    </div>
  );
}
