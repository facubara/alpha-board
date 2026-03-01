import { NextRequest, NextResponse } from "next/server";
import { workerGet } from "@/lib/worker-client";
import type { PreviousClosesData, Timeframe } from "@/lib/types";

const VALID_TIMEFRAMES = new Set<Timeframe>(["15m", "30m", "1h", "4h", "1d", "1w"]);
const VALID_COUNTS = new Set([3, 5, 7, 10]);

/**
 * GET /api/rankings/[timeframe]/history/[symbolId]?count=5
 *
 * Proxies to worker to fetch previous closes for a symbol.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ timeframe: string; symbolId: string }> }
) {
  const { timeframe, symbolId } = await params;
  const id = Number(symbolId);

  if (!VALID_TIMEFRAMES.has(timeframe as Timeframe)) {
    return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 });
  }

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid symbol ID" }, { status: 400 });
  }

  const count = Number(request.nextUrl.searchParams.get("count") ?? 5);
  if (!VALID_COUNTS.has(count)) {
    return NextResponse.json({ error: "Invalid count" }, { status: 400 });
  }

  try {
    const data = await workerGet<PreviousClosesData>(
      `/rankings/${timeframe}/history/${id}?count=${count}`
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch previous closes" },
      { status: 500 }
    );
  }
}
