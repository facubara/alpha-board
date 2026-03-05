import { Suspense } from "react";
import { AgentLeaderboard } from "@/components/agents";
import { DiscardedAgents } from "@/components/agents/discarded-agents";
import { FleetLessons } from "@/components/agents/fleet-lessons";
import { getAgentLeaderboard } from "@/lib/queries/agents";
import { getDiscardedAgents } from "@/lib/queries/agents";
import { getFleetLessons } from "@/lib/queries/lessons";
import { PageHeader } from "@/components/terminal";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const revalidate = 30;

/**
 * Async section that fetches all agents data.
 * Wrapped in Suspense so the page header renders instantly.
 */
async function AgentsContent() {
  const [agents, discarded, lessons] = await Promise.all([
    getAgentLeaderboard().catch(() => undefined),
    getDiscardedAgents().catch(() => undefined),
    getFleetLessons().catch(() => undefined),
  ]);

  return (
    <>
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
    </>
  );
}

function AgentsContentSkeleton() {
  return (
    <>
      {/* Filter skeleton */}
      <div className="rounded-none border border-void-border bg-void-surface p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 w-16 rounded-none bg-void-muted skeleton" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 w-16 rounded-none bg-void-muted skeleton" />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-none border border-void-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-void-border bg-void-surface hover:bg-void-surface">
                <TableHead className="text-xs font-medium text-text-secondary">Agent</TableHead>
                <TableHead className="hidden w-16 text-xs font-medium text-text-secondary sm:table-cell">TF</TableHead>
                <TableHead className="w-24 text-right text-xs font-medium text-text-secondary">Realized</TableHead>
                <TableHead className="hidden w-20 text-right text-xs font-medium text-text-secondary sm:table-cell">uPnL</TableHead>
                <TableHead className="hidden w-20 text-right text-xs font-medium text-text-secondary md:table-cell">Win%</TableHead>
                <TableHead className="hidden w-16 text-right text-xs font-medium text-text-secondary md:table-cell">Trades</TableHead>
                <TableHead className="hidden w-16 text-right text-xs font-medium text-text-secondary lg:table-cell">Open</TableHead>
                <TableHead className="hidden w-20 text-right text-xs font-medium text-text-secondary lg:table-cell">Cost</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 12 }).map((_, i) => (
                <TableRow key={i} className="h-12 border-b border-void-border">
                  <td className="px-4 py-2"><div className="h-4 w-40 animate-pulse rounded-none bg-void-muted" /></td>
                  <td className="hidden px-4 py-2 sm:table-cell"><div className="h-4 w-8 animate-pulse rounded-none bg-void-muted" /></td>
                  <td className="px-4 py-2 text-right"><div className="ml-auto h-4 w-16 animate-pulse rounded-none bg-void-muted" /></td>
                  <td className="hidden px-4 py-2 text-right sm:table-cell"><div className="ml-auto h-4 w-14 animate-pulse rounded-none bg-void-muted" /></td>
                  <td className="hidden px-4 py-2 text-right md:table-cell"><div className="ml-auto h-4 w-10 animate-pulse rounded-none bg-void-muted" /></td>
                  <td className="hidden px-4 py-2 text-right md:table-cell"><div className="ml-auto h-4 w-8 animate-pulse rounded-none bg-void-muted" /></td>
                  <td className="hidden px-4 py-2 text-right lg:table-cell"><div className="ml-auto h-4 w-8 animate-pulse rounded-none bg-void-muted" /></td>
                  <td className="hidden px-4 py-2 text-right lg:table-cell"><div className="ml-auto h-4 w-12 animate-pulse rounded-none bg-void-muted" /></td>
                  <td className="px-4 py-2" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

export default function AgentsPage() {
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

      <Suspense fallback={<AgentsContentSkeleton />}>
        <AgentsContent />
      </Suspense>
    </div>
  );
}
