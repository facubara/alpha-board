import { NextRequest, NextResponse } from "next/server";
import { getAccountCallHistory } from "@/lib/queries/memecoins";

/**
 * GET /api/memecoins/twitter/accounts/[id]/calls — Token call history for an account
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const accountId = Number(id);

  if (!accountId || !Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });
  }

  const calls = await getAccountCallHistory(accountId);
  return NextResponse.json(calls);
}
