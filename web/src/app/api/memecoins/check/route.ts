import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "https://alpha-worker.fly.dev";

/**
 * POST /api/memecoins/check — Cross-reference a token's buyers against analyzed wallets
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { mintAddress } = body as { mintAddress?: string };

  if (!mintAddress || mintAddress.length > 64) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  const res = await fetch(`${WORKER_URL}/memecoins/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mint_address: mintAddress }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

/**
 * GET /api/memecoins/check — List past cross-reference checks
 */
export async function GET() {
  const res = await fetch(`${WORKER_URL}/memecoins/checks`, {
    next: { revalidate: 10 },
  });

  const data = await res.json();
  return NextResponse.json(data);
}
