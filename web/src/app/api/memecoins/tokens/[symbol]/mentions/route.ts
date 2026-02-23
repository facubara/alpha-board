import { NextRequest, NextResponse } from "next/server";
import { getTweetsByToken } from "@/lib/queries/memecoins";

/**
 * GET /api/memecoins/tokens/[symbol]/mentions — Tweets mentioning a token
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  if (!symbol || symbol.length > 20) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const mentions = await getTweetsByToken(symbol);
  return NextResponse.json(mentions);
}
