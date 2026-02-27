import { getAgentLeaderboard, getDiscardedAgents } from "@/lib/queries/agents";
import { getFleetLessons } from "@/lib/queries/lessons";
import { AgentLeaderboard } from "@/components/agents";
import { DiscardedAgents } from "@/components/agents/discarded-agents";
import { FleetLessons } from "@/components/agents/fleet-lessons";

/**
 * Agents Leaderboard Page (Server Component)
 *
 * Fetches all agents with performance metrics.
 * ISR: Revalidates every 60 seconds to stay current with agent decisions.
 */

export const revalidate = 60;

export default async function AgentsPage() {
  const [agents, discarded, fleetLessons] = await Promise.all([
    getAgentLeaderboard(),
    getDiscardedAgents().catch(() => []),
    getFleetLessons().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Agent Arena</h1>
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

      {/* Agent type legend */}
      <details className="text-sm text-secondary">
        <summary className="cursor-pointer font-medium text-primary hover:text-secondary">Agent types</summary>
        <p className="mt-2 text-xs text-muted">
          <span className="font-medium text-secondary">RB</span> = Rule-Based &middot;{" "}
          <span className="font-medium text-secondary">HYB</span> = Hybrid &middot;{" "}
          <span className="font-medium text-secondary">TW-LLM</span> = Twitter LLM &middot;{" "}
          <span className="font-medium text-secondary">LLM</span> = Pure LLM
        </p>
      </details>

      {/* Leaderboard */}
      <AgentLeaderboard agents={agents} />

      {/* Fleet lessons section */}
      {fleetLessons.length > 0 && (
        <div className="border-t border-[var(--border-default)] pt-6">
          <FleetLessons lessons={fleetLessons} />
        </div>
      )}

      {/* Discarded agents section */}
      {discarded.length > 0 && (
        <div className="border-t border-[var(--border-default)] pt-6">
          <DiscardedAgents agents={discarded} />
        </div>
      )}
    </div>
  );
}
