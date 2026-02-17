import { NextResponse } from "next/server";
import { getFleetLessons } from "@/lib/queries/lessons";

/**
 * GET /api/lessons
 *
 * Return all active fleet lessons.
 */
export async function GET() {
  try {
    const lessons = await getFleetLessons();
    return NextResponse.json(lessons);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
