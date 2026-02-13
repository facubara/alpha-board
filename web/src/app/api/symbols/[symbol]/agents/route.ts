import { NextResponse } from "next/server";
import { getSymbolAgentActivity } from "@/lib/queries/agents";

const SYMBOL_RE = /^[A-Z0-9]{2,20}$/;

/**
 * GET /api/symbols/[symbol]/agents
 *
 * Returns agent activity (open positions + recent trades) for a symbol.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  if (!SYMBOL_RE.test(upper)) {
    return NextResponse.json(
      { error: "Invalid symbol format" },
      { status: 400 }
    );
  }

  try {
    const activity = await getSymbolAgentActivity(upper);
    return NextResponse.json(activity);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch agent activity" },
      { status: 500 }
    );
  }
}
