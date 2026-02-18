import { NextResponse } from "next/server";
import { getAllOpenPositions } from "@/lib/queries/agents";
import type { AgentPosition } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/positions/all
 *
 * Returns all open positions grouped by agent ID.
 * Used by leaderboard for client-side uPnL calculation.
 */
export async function GET() {
  try {
    const positions = await getAllOpenPositions();

    const grouped: Record<number, AgentPosition[]> = {};
    for (const pos of positions) {
      if (!grouped[pos.agentId]) grouped[pos.agentId] = [];
      grouped[pos.agentId].push(pos);
    }

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Failed to fetch all positions:", error);
    return NextResponse.json({}, { status: 500 });
  }
}
