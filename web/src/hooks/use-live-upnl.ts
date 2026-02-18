"use client";

/**
 * Live uPnL Calculation Utilities
 *
 * Client-side uPnL calculation matching the worker formula:
 * - LONG:  positionSize * (currentPrice - entryPrice) / entryPrice
 * - SHORT: positionSize * (entryPrice - currentPrice) / entryPrice
 */

import { useMemo } from "react";
import type { AgentPosition } from "@/lib/types";

/**
 * Calculate uPnL for a single position given the current price.
 */
export function calculatePositionUpnl(
  position: AgentPosition,
  currentPrice: number | undefined
): number | undefined {
  if (currentPrice === undefined || position.entryPrice <= 0) return undefined;

  if (position.direction === "long") {
    return (
      position.positionSize *
      (currentPrice - position.entryPrice) /
      position.entryPrice
    );
  }
  return (
    position.positionSize *
    (position.entryPrice - currentPrice) /
    position.entryPrice
  );
}

/**
 * Calculate total uPnL for an agent by summing across all positions.
 */
export function calculateAgentUpnl(
  positions: AgentPosition[],
  prices: Map<string, number>
): number | undefined {
  if (positions.length === 0) return 0;

  let total = 0;
  for (const pos of positions) {
    const price = prices.get(pos.symbol);
    const pnl = calculatePositionUpnl(pos, price);
    if (pnl === undefined) return undefined; // Missing price for a position
    total += pnl;
  }
  return total;
}

interface LiveUpnlResult {
  upnl: number | undefined;
  totalPnl: number | undefined;
  equity: number | undefined;
}

/**
 * Hook returning live uPnL, totalPnl, and equity based on current prices.
 *
 * Matches worker formula:
 *   live_equity = cashBalance + sum(positionSize) + sum(positionUpnl)
 *   live_pnl = live_equity - initialBalance
 *   display_upnl = live_pnl - totalRealizedPnl
 */
export function useLiveUpnl(
  positions: AgentPosition[],
  prices: Map<string, number>,
  pricesReady: boolean,
  agent: { cashBalance: number; initialBalance: number; totalRealizedPnl: number }
): LiveUpnlResult {
  return useMemo(() => {
    if (!pricesReady || positions.length === 0) {
      if (pricesReady && positions.length === 0) {
        // No positions = no unrealized PnL
        const equity = agent.cashBalance;
        const totalPnl = equity - agent.initialBalance;
        return { upnl: 0, totalPnl, equity };
      }
      return { upnl: undefined, totalPnl: undefined, equity: undefined };
    }

    let unrealizedSum = 0;
    let positionsValue = 0;

    for (const pos of positions) {
      const price = prices.get(pos.symbol);
      const pnl = calculatePositionUpnl(pos, price);
      if (pnl === undefined) {
        return { upnl: undefined, totalPnl: undefined, equity: undefined };
      }
      unrealizedSum += pnl;
      positionsValue += pos.positionSize;
    }

    const equity = agent.cashBalance + positionsValue + unrealizedSum;
    const totalPnl = equity - agent.initialBalance;
    const upnl = totalPnl - agent.totalRealizedPnl;

    return {
      upnl: Math.round(upnl * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      equity: Math.round(equity * 100) / 100,
    };
  }, [positions, prices, pricesReady, agent.cashBalance, agent.initialBalance, agent.totalRealizedPnl]);
}
