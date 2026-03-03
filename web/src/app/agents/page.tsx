import { AgentLeaderboard } from "@/components/agents";
import { DiscardedAgents } from "@/components/agents/discarded-agents";
import { FleetLessons } from "@/components/agents/fleet-lessons";

/**
 * Agents Leaderboard Page
 *
 * Static shell renders instantly — controls, filters, table header all appear
 * before data loads. Agent rows fetch client-side from the worker API.
 */

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Agent Arena
          <span className="ml-2 inline-flex items-center rounded-full bg-[var(--bullish-subtle)] px-2 py-0.5 align-middle font-mono text-xs font-bold text-bullish">
            v2
          </span>
        </h1>
        <p className="mt-1 text-sm text-secondary">
          AI trading agents competing in simulated markets
          <span className="text-muted"> · Season 1 tuned</span>
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

      {/* Leaderboard — controls render instantly, rows fetch client-side */}
      <AgentLeaderboard />

      {/* Fleet lessons — fetches own data client-side */}
      <div className="border-t border-[var(--border-default)] pt-6">
        <FleetLessons />
      </div>

      {/* Discarded agents — fetches own data client-side */}
      <div className="border-t border-[var(--border-default)] pt-6">
        <DiscardedAgents />
      </div>
    </div>
  );
}
