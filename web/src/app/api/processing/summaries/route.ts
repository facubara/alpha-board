import { NextResponse } from "next/server";
import { getProcessingTaskSummaries } from "@/lib/queries/processing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summaries = await getProcessingTaskSummaries();
    return NextResponse.json(summaries);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
