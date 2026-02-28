import { NextResponse } from "next/server";
import { getProcessingRunHistory } from "@/lib/queries/processing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 20);
    const runs = await getProcessingRunHistory(limit);
    return NextResponse.json(runs);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
