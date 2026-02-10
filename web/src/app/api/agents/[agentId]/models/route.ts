import { NextRequest, NextResponse } from "next/server";
import { updateAgentModels } from "@/lib/queries/agents";

/**
 * POST /api/agents/[agentId]/models
 *
 * Update an agent's model configuration (scan, trade, evolution).
 */

const VALID_MODELS = new Set([
  "claude-haiku-3-5-20241022",
  "claude-sonnet-4-20250514",
  "claude-opus-4-5-20251101",
]);

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
  const { scan_model, trade_model, evolution_model } = body;

  // Validate all three models
  for (const [key, value] of Object.entries({
    scan_model,
    trade_model,
    evolution_model,
  })) {
    if (!value || typeof value !== "string") {
      return NextResponse.json(
        { error: `${key} is required` },
        { status: 400 }
      );
    }
    if (!VALID_MODELS.has(value)) {
      return NextResponse.json(
        { error: `Invalid model: ${value}` },
        { status: 400 }
      );
    }
  }

  try {
    await updateAgentModels(id, scan_model, trade_model, evolution_model);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}
