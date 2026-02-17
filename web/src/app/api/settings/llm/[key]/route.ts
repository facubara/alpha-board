import { NextRequest, NextResponse } from "next/server";
import { toggleLlmSection } from "@/lib/queries/settings";

/**
 * POST /api/settings/llm/[key]
 *
 * Toggle a section's enabled/disabled state.
 * Auth is handled by the client-side requireAuth() flow.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  try {
    const result = await toggleLlmSection(key);
    if (!result) {
      return NextResponse.json(
        { error: `Section '${key}' not found` },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to toggle setting" },
      { status: 500 }
    );
  }
}
