/**
 * Consensus Queries
 *
 * Computes agent position consensus per symbol, grouped by source type.
 * Used by the consensus ticker banner.
 */

import { sql } from "@/lib/db";
import type { AgentSource, ConsensusData, ConsensusItem } from "@/lib/types";

interface RawRow {
  symbol: string;
  source: AgentSource;
  direction: "long" | "short";
  agent_count: string;
}

/**
 * Fetch position consensus across all active agents.
 *
 * Groups open positions by symbol + source + direction, then computes
 * consensus percentage for each symbol within each source category.
 */
export async function getConsensusData(): Promise<ConsensusData> {
  // Query 1: open positions grouped by symbol/source/direction
  const rows = (await sql`
    SELECT
      sym.symbol,
      a.source,
      ap.direction,
      COUNT(*)::text as agent_count
    FROM agent_positions ap
    JOIN agents a ON a.id = ap.agent_id
    JOIN symbols sym ON sym.id = ap.symbol_id
    WHERE a.status = 'active'
    GROUP BY sym.symbol, a.source, ap.direction
  `) as RawRow[];

  // Query 2: total active agents per source (denominator)
  const agentCountRows = (await sql`
    SELECT source, COUNT(*)::text as agent_count
    FROM agents
    WHERE status = 'active'
    GROUP BY source
  `) as { source: AgentSource; agent_count: string }[];

  const agentCounts = new Map<string, number>();
  let totalAllAgents = 0;
  for (const row of agentCountRows) {
    const count = Number(row.agent_count);
    agentCounts.set(row.source, count);
    totalAllAgents += count;
  }

  // Build lookup: { symbol -> { source -> { long: n, short: n } } }
  const lookup = new Map<string, Map<string, { long: number; short: number }>>();

  for (const row of rows) {
    const count = Number(row.agent_count);
    if (!lookup.has(row.symbol)) {
      lookup.set(row.symbol, new Map());
    }
    const sourceMap = lookup.get(row.symbol)!;
    if (!sourceMap.has(row.source)) {
      sourceMap.set(row.source, { long: 0, short: 0 });
    }
    sourceMap.get(row.source)![row.direction] += count;
  }

  function computeConsensus(
    filterSources: AgentSource[] | null
  ): ConsensusItem[] {
    const items: ConsensusItem[] = [];

    // Compute total active agents for the filtered sources
    let totalActiveAgents = 0;
    if (filterSources === null) {
      totalActiveAgents = totalAllAgents;
    } else {
      for (const src of filterSources) {
        totalActiveAgents += agentCounts.get(src) ?? 0;
      }
    }

    if (totalActiveAgents < 2) return items;

    for (const [symbol, sourceMap] of lookup) {
      let totalLongs = 0;
      let totalShorts = 0;

      for (const [source, counts] of sourceMap) {
        if (filterSources === null || filterSources.includes(source as AgentSource)) {
          totalLongs += counts.long;
          totalShorts += counts.short;
        }
      }

      const positioned = totalLongs + totalShorts;
      if (positioned === 0) continue;

      const majority = Math.max(totalLongs, totalShorts);
      const consensusPct = Math.round((majority / totalActiveAgents) * 100);

      if (consensusPct < 50) continue;

      items.push({
        symbol,
        direction: totalLongs >= totalShorts ? "long" : "short",
        consensusPct,
        longCount: totalLongs,
        shortCount: totalShorts,
        totalAgents: totalActiveAgents,
      });
    }

    // Sort by consensus % descending
    items.sort((a, b) => b.consensusPct - a.consensusPct);
    return items;
  }

  return {
    technical: computeConsensus(["technical"]),
    tweet: computeConsensus(["tweet"]),
    mixed: computeConsensus(null), // all sources combined
  };
}
