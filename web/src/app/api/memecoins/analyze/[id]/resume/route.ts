import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "https://alpha-worker.fly.dev";

/**
 * POST /api/memecoins/analyze/[id]/resume — Resume a paused/failed analysis
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const res = await fetch(`${WORKER_URL}/memecoins/analyze/${id}/resume`, {
    method: "POST",
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
