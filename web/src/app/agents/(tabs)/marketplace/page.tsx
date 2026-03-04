import { AgentLeaderboard } from "@/components/agents";
import { DiscardedAgents } from "@/components/agents/discarded-agents";
import { FleetLessons } from "@/components/agents/fleet-lessons";
import { getAgentLeaderboard } from "@/lib/queries/agents";
import { getDiscardedAgents } from "@/lib/queries/agents";
import { getFleetLessons } from "@/lib/queries/lessons";
import { PageHeader } from "@/components/terminal";

/**
 * Agents Leaderboard Page
 *
 * Server-fetches all data so the page renders with content on first load.
 * Components still revalidate client-side via useFetch for live updates.
 */

export default async function AgentsPage() {
  const [agents, discarded, lessons] = await Promise.all([
    getAgentLeaderboard().catch(() => undefined),
    getDiscardedAgents().catch(() => undefined),
    getFleetLessons().catch(() => undefined),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Agent Arena"
        badge="v2"
        subtitle="AI trading agents competing in simulated markets · 5 seasons active"
      />

      {/* Disclaimer */}
      <div className="rounded-none border border-void-border bg-void-surface px-3 py-2 text-xs text-text-tertiary">
        SIMULATED TRADING — All balances and trades are virtual. Not financial advice.
      </div>

      {/* Agent type legend */}
      <details className="text-sm text-text-secondary">
        <summary className="cursor-pointer font-medium text-text-primary hover:text-text-secondary">Agent types</summary>
        <p className="mt-2 text-xs text-text-tertiary">
          <span className="font-medium text-text-secondary">RB</span> = Rule-Based &middot;{" "}
          <span className="font-medium text-text-secondary">HYB</span> = Hybrid &middot;{" "}
          <span className="font-medium text-text-secondary">TW-LLM</span> = Twitter LLM &middot;{" "}
          <span className="font-medium text-text-secondary">LLM</span> = Pure LLM
        </p>
      </details>

      {/* Leaderboard — server data hydrates instantly, client revalidates */}
      <AgentLeaderboard agents={agents} />

      {/* Fleet lessons */}
      <div className="border-t border-void-border pt-6">
        <FleetLessons lessons={lessons} />
      </div>

      {/* Discarded agents */}
      <div className="border-t border-void-border pt-6">
        <DiscardedAgents agents={discarded} />
      </div>
    </div>
  );
}
