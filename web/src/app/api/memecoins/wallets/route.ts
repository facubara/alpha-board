import { NextRequest, NextResponse } from "next/server";
import { workerGet, workerPost, workerDelete } from "@/lib/worker-client";

/**
 * GET /api/memecoins/wallets — List watch wallets
 */
export async function GET() {
  const wallets = await workerGet("/memecoins/wallets");
  return NextResponse.json(wallets);
}

/**
 * POST /api/memecoins/wallets — Add a manual wallet
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await workerPost("/memecoins/wallets", body);
  return NextResponse.json(result);
}

/**
 * DELETE /api/memecoins/wallets — Deactivate a wallet (pass address as query param)
 */
export async function DELETE(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  const result = await workerDelete(`/memecoins/wallets/${address}`);
  return NextResponse.json(result);
}
