import { NextRequest, NextResponse } from "next/server";
import { toggleAgentStatus } from "@/lib/queries/agents";

/**
 * POST /api/agents/[agentId]/status
 *
 * Toggle an agent's status between active and paused.
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
    const status = await toggleAgentStatus(id);
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}
