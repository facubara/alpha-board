import { NextRequest, NextResponse } from "next/server";
import { workerGet, workerPost } from "@/lib/worker-client";

/**
 * POST /api/agents/[agentId]/status
 *
 * Toggle an agent's status between active and paused.
 * When pausing, proxies to the worker to close positions + send notification.
 * When resuming, uses the toggle endpoint.
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

  try {
    // Check current status
    const agent = await workerGet<{ status: string }>(`/agents/${id}`);

    if (agent.status === "active") {
      // Pause via worker to close positions + send Telegram notification
      try {
        await workerPost(`/agents/${id}/pause`);
        return NextResponse.json({ status: "paused" });
      } catch {
        // Fall through to toggle if full pause fails
      }
    }

    // Toggle (resume from paused, or fallback)
    const result = await workerPost<{ status: string }>(`/agents/${id}/toggle`);
    return NextResponse.json({ status: result.status });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}
