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
  const { scan_model, trade_model, evolution_model, max_positions } = body;

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

  // Validate max_positions (optional, 1-20)
  let validatedMaxPositions: number | undefined;
  if (max_positions !== undefined) {
    const mp = Number(max_positions);
    if (!Number.isInteger(mp) || mp < 1 || mp > 20) {
      return NextResponse.json(
        { error: "max_positions must be an integer between 1 and 20" },
        { status: 400 }
      );
    }
    validatedMaxPositions = mp;
  }

  try {
    await updateAgentModels(id, scan_model, trade_model, evolution_model, validatedMaxPositions);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}
