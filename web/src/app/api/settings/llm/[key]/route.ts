import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { toggleLlmSection } from "@/lib/queries/settings";

/**
 * POST /api/settings/llm/[key]
 *
 * Toggle a section's enabled/disabled state.
 * Auth-protected via cookie check.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  // Auth check
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  if (!session?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
