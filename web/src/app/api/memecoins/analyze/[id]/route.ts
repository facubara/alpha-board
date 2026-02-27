import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "https://alpha-worker.fly.dev";

/**
 * GET /api/memecoins/analyze/[id] — Get analysis status and results
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const res = await fetch(`${WORKER_URL}/memecoins/analyze/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Analysis not found" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
