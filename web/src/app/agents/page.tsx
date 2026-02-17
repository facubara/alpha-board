import { getAgentLeaderboard, getDiscardedAgents } from "@/lib/queries/agents";
import { AgentLeaderboard } from "@/components/agents";
import { DiscardedAgents } from "@/components/agents/discarded-agents";

/**
 * Agents Leaderboard Page (Server Component)
 *
 * Fetches all agents with performance metrics.
 * ISR: Revalidates every 60 seconds to stay current with agent decisions.
 */

export const revalidate = 60;

export default async function AgentsPage() {
  const [agents, discarded] = await Promise.all([
    getAgentLeaderboard(),
    getDiscardedAgents().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Agent Arena</h1>
        <p className="mt-1 text-sm text-secondary">
          {agents.length} AI trading agents competing in simulated markets
          {discarded.length > 0 && (
            <span className="text-muted"> · {discarded.length} discarded</span>
          )}
        </p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-muted">
        SIMULATED TRADING — All balances and trades are virtual. Not financial advice.
      </div>

      {/* Leaderboard */}
      <AgentLeaderboard agents={agents} />

      {/* Discarded agents section */}
      {discarded.length > 0 && <DiscardedAgents agents={discarded} />}
    </div>
  );
}
