import { NextRequest, NextResponse } from "next/server";
import { getTrackedTokens } from "@/lib/queries/memecoins";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

/**
 * GET /api/memecoins/tracker — List all active tracked tokens (from Neon)
 */
export async function GET() {
  const tokens = await getTrackedTokens();
  return NextResponse.json(tokens);
}

/**
 * POST /api/memecoins/tracker — Add a token (proxy to worker)
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { mint_address, refresh_interval_minutes } = body as {
    mint_address?: string;
    refresh_interval_minutes?: number;
  };

  if (!mint_address || mint_address.length > 64) {
    return NextResponse.json(
      { error: "Invalid mint address" },
      { status: 400 }
    );
  }

  const res = await fetch(`${WORKER_URL}/memecoins/tracker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mint_address,
      refresh_interval_minutes: refresh_interval_minutes ?? 15,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
