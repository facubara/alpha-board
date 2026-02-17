import { NextRequest, NextResponse } from "next/server";
import { reactivateAgent } from "@/lib/queries/agents";

/**
 * POST /api/agents/[agentId]/reactivate
 *
 * Re-activate a discarded agent.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const id = Number(agentId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
  }

  try {
    await reactivateAgent(id);
    return NextResponse.json({ status: "active" });
  } catch {
    return NextResponse.json({ error: "Agent not found or not discarded" }, { status: 404 });
  }
}
