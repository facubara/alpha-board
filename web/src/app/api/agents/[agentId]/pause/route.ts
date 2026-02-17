import { NextRequest, NextResponse } from "next/server";
import { pauseSingleAgent } from "@/lib/queries/agents";

/**
 * POST /api/agents/[agentId]/pause
 *
 * Pause a single agent by ID. Used by the progressive pause modal.
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
    const result = await pauseSingleAgent(id);
    if (!result) {
      return NextResponse.json(
        { error: "Agent not found or already paused" },
        { status: 404 }
      );
    }
    return NextResponse.json({ id: result.id, name: result.name, paused: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to pause agent" },
      { status: 500 }
    );
  }
}
