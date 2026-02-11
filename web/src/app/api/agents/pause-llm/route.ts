import { NextResponse } from "next/server";
import { pauseAllLlmAgents } from "@/lib/queries/agents";

/**
 * POST /api/agents/pause-llm
 *
 * Pause all LLM-engine agents that are currently active.
 */
export async function POST() {
  try {
    const count = await pauseAllLlmAgents();
    return NextResponse.json({ paused: count });
  } catch {
    return NextResponse.json(
      { error: "Failed to pause LLM agents" },
      { status: 500 }
    );
  }
}
