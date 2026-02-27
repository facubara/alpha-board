import { useMemo } from "react";
import { useFetch } from "./use-fetch";
import { useBinancePrices } from "./use-binance-prices";
import { calculateAgentUpnl } from "./use-live-upnl";
import type { AgentLeaderboardRow, AgentPosition } from "@/lib/types";

interface UseAgentPositionsResult {
  allPositions: Record<number, AgentPosition[]>;
  agentUpnlMap: Map<number, number | undefined>;
}

export function useAgentPositions(
  agentsData: AgentLeaderboardRow[]
): UseAgentPositionsResult {
  const { data: allPositions } = useFetch<Record<number, AgentPosition[]>>(
    "/api/positions/all",
    { pollInterval: 30_000 }
  );

  const positionsMap = allPositions ?? {};

  // Extract unique symbols across all positions
  const allSymbols = useMemo(() => {
    const symbols = new Set<string>();
    for (const positions of Object.values(positionsMap)) {
      for (const pos of positions) {
        symbols.add(pos.symbol);
      }
    }
    return [...symbols];
  }, [positionsMap]);

  const { prices, pricesReady } = useBinancePrices(allSymbols);

  // Pre-compute per-agent uPnL
  const agentUpnlMap = useMemo(() => {
    const map = new Map<number, number | undefined>();
    if (!pricesReady) return map;

    for (const agent of agentsData) {
      const positions = positionsMap[agent.id];
      if (!positions || positions.length === 0) {
        map.set(agent.id, 0);
      } else {
        map.set(agent.id, calculateAgentUpnl(positions, prices));
      }
    }
    return map;
  }, [agentsData, positionsMap, prices, pricesReady]);

  return { allPositions: positionsMap, agentUpnlMap };
}
