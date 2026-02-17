import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

/**
 * POST /api/backtest/cancel — Proxy cancel request to worker (auth-protected by middleware)
 * Body: { runId: number }
 */
export async function POST(request: NextRequest) {
  if (!WORKER_URL) {
    return NextResponse.json(
      { error: "Worker URL not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { runId } = body as { runId?: number };

  if (!runId || !Number.isInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  const res = await fetch(`${WORKER_URL}/backtest/${runId}/cancel`, {
    method: "POST",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.detail || `Worker returned ${res.status}` },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}
