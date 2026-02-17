import { NextRequest, NextResponse } from "next/server";
import { deactivateFleetLesson } from "@/lib/queries/lessons";

/**
 * DELETE /api/lessons/[lessonId]
 *
 * Deactivate (soft-delete) a fleet lesson.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const id = Number(lessonId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid lesson ID" }, { status: 400 });
  }

  try {
    await deactivateFleetLesson(id);
    return NextResponse.json({ deactivated: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
