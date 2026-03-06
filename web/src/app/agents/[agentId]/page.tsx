import { cache } from "react";
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
import { getAgentAnalysisHistory } from "@/lib/queries/processing";
import { AgentDetail } from "@/components/agents/agent-detail";

/**
 * Agent Detail Page (Server Component)
 *
 * Fetches all data for a single agent in parallel.
 * ISR: Revalidates every 30 seconds for active agent monitoring.
 */

export const revalidate = 30;

// React.cache deduplicates getAgentDetail across generateMetadata + page render
const getCachedAgentDetail = cache(getAgentDetail);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>;
}): Promise<Metadata> {
  try {
    const { agentId } = await params;
    const id = Number(agentId);
    if (!Number.isInteger(id) || id <= 0) {
      return { title: "Agent Not Found | Alpha Board" };
    }
    const agent = await getCachedAgentDetail(id);
    if (!agent) {
      return { title: "Agent Not Found | Alpha Board" };
    }
    return {
      title: `${agent.displayName} | Alpha Board`,
    };
  } catch {
    return { title: "Agent | Alpha Board" };
  }
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

  // Fetch all data in parallel — sub-queries use catch fallbacks
  // so discarded/inactive agents still render with partial data.
  // getCachedAgentDetail is deduped with generateMetadata (no double fetch).
  const [agent, trades, decisions, promptHistory, positions, tokenUsage, analysisHistory] =
    await Promise.all([
      getCachedAgentDetail(id),
      getAgentTrades(id).catch(() => []),
      getAgentDecisions(id).catch(() => []),
      getAgentPromptHistory(id).catch(() => []),
      getAgentOpenPositions(id).catch(() => []),
      getAgentTokenUsage(id).catch(() => []),
      getAgentAnalysisHistory(id).catch(() => []),
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
      analysisHistory={analysisHistory}
    />
  );
}
