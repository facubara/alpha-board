import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAgentDetail,
  getAgentTrades,
  getAgentDecisions,
  getAgentPromptHistory,
  getAgentOpenPositions,
  getAgentTokenUsage,
} from "@/lib/queries/agents";
import { AgentDetail } from "@/components/agents/agent-detail";

/**
 * Agent Detail Page (Server Component)
 *
 * Fetches all data for a single agent in parallel.
 * ISR: Revalidates every 30 seconds for active agent monitoring.
 */

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>;
}): Promise<Metadata> {
  const { agentId } = await params;
  const id = Number(agentId);
  if (!Number.isInteger(id) || id <= 0) {
    return { title: "Agent Not Found | Alpha Board" };
  }
  const agent = await getAgentDetail(id);
  if (!agent) {
    return { title: "Agent Not Found | Alpha Board" };
  }
  return {
    title: `${agent.displayName} | Alpha Board`,
  };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const id = Number(agentId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  // Fetch all data in parallel
  const [agent, trades, decisions, promptHistory, positions, tokenUsage] =
    await Promise.all([
      getAgentDetail(id),
      getAgentTrades(id),
      getAgentDecisions(id),
      getAgentPromptHistory(id),
      getAgentOpenPositions(id),
      getAgentTokenUsage(id),
    ]);

  if (!agent) {
    notFound();
  }

  return (
    <AgentDetail
      agent={agent}
      trades={trades}
      decisions={decisions}
      promptHistory={promptHistory}
      positions={positions}
      tokenUsage={tokenUsage}
    />
  );
}
