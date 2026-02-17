import { NextResponse } from "next/server";
import { getActiveLlmAgents } from "@/lib/queries/agents";

/**
 * GET /api/agents/active-llm
 *
 * Returns list of active LLM agent IDs and names.
 * Used by the progressive pause modal to enumerate agents before pausing.
 */
export async function GET() {
  try {
    const agents = await getActiveLlmAgents();
    return NextResponse.json({ agents });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch active LLM agents" },
      { status: 500 }
    );
  }
}
