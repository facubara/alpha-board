import { NextRequest, NextResponse } from "next/server";
import { toggleAgentStatus } from "@/lib/queries/agents";

const WORKER_URL = process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL;

/**
 * POST /api/agents/[agentId]/status
 *
 * Toggle an agent's status between active and paused.
 * When pausing, proxies to the worker to close positions + send notification.
 * When resuming, directly updates the DB.
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
    // Check current status to decide approach
    const { sql } = await import("@/lib/db");
    const rows = await sql`SELECT status FROM agents WHERE id = ${id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const currentStatus = rows[0].status as string;

    if (currentStatus === "active" && WORKER_URL) {
      // Pause via worker to close positions + send Telegram notification
      try {
        const workerRes = await fetch(`${WORKER_URL}/agents/${id}/pause`, {
          method: "POST",
        });
        if (workerRes.ok) {
          return NextResponse.json({ status: "paused" });
        }
        // Fall through to direct DB toggle if worker fails
      } catch {
        // Worker unreachable, fall through to direct DB toggle
      }
    }

    // Direct DB toggle (resume, or fallback for pause)
    const status = await toggleAgentStatus(id);
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}
