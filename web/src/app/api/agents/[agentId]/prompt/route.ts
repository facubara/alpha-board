import { NextRequest, NextResponse } from "next/server";
import { saveAgentPrompt } from "@/lib/queries/agents";

/**
 * POST /api/agents/[agentId]/prompt
 *
 * Save a human-edited strategy prompt for an agent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const id = Number(agentId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
  }

  const body = await request.json();
  const systemPrompt = body.system_prompt;

  if (!systemPrompt || typeof systemPrompt !== "string") {
    return NextResponse.json(
      { error: "system_prompt is required" },
      { status: 400 }
    );
  }

  if (systemPrompt.length < 50) {
    return NextResponse.json(
      { error: "Prompt too short (minimum 50 characters)" },
      { status: 400 }
    );
  }

  try {
    const version = await saveAgentPrompt(id, systemPrompt);
    return NextResponse.json({ version });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}
