import { NextRequest, NextResponse } from "next/server";
import { workerGet } from "@/lib/worker-client";

/**
 * GET /api/memecoins/tracker/[mint]/snapshots — Get historical snapshots for a token
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const snapshots = await workerGet(`/memecoins/tracker/${mint}/snapshots`);
  return NextResponse.json(snapshots);
}
