import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

/**
 * POST /api/backtest — Proxy backtest launch to worker (auth-protected by middleware)
 */
export async function POST(request: NextRequest) {
  if (!WORKER_URL) {
    return NextResponse.json(
      { error: "Worker URL not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();

  const res = await fetch(`${WORKER_URL}/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
