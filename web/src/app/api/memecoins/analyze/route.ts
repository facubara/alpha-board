import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "https://alpha-worker.fly.dev";

/**
 * POST /api/memecoins/analyze — Start a token analysis
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { mintAddress, numBuyers } = body as {
    mintAddress?: string;
    numBuyers?: number;
  };

  if (!mintAddress || mintAddress.length > 64) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  const res = await fetch(`${WORKER_URL}/memecoins/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mint_address: mintAddress,
      num_buyers: numBuyers || 50,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

/**
 * GET /api/memecoins/analyze — List all analyses
 */
export async function GET() {
  const res = await fetch(`${WORKER_URL}/memecoins/analyses`, {
    next: { revalidate: 10 },
  });

  const data = await res.json();
  return NextResponse.json(data);
}
