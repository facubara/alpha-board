/**
 * Fleet Lessons Queries
 *
 * Fetches and manages fleet lessons from post-mortem analysis of discarded agents.
 */

import { cached } from "@/lib/cache";
import { sql } from "@/lib/db";
import type { FleetLesson, FleetLessonCategory } from "@/lib/types";

/**
 * Fetch all active fleet lessons joined with agent name.
 */
export function getFleetLessons(): Promise<FleetLesson[]> {
  return cached("fleet:lessons", 120, async () => {
    const rows = await sql`
      SELECT
        fl.id,
        fl.agent_id,
        a.display_name as agent_name,
        fl.archetype,
        fl.category,
        fl.lesson,
        fl.context,
        fl.is_active,
        fl.created_at
      FROM fleet_lessons fl
      JOIN agents a ON a.id = fl.agent_id
      WHERE fl.is_active = true
      ORDER BY fl.created_at DESC
    `;

    return rows.map((r) => ({
      id: Number(r.id),
      agentId: Number(r.agent_id),
      agentName: String(r.agent_name),
      archetype: String(r.archetype),
      category: String(r.category) as FleetLessonCategory,
      lesson: String(r.lesson),
      context: r.context as Record<string, unknown> | null,
      isActive: Boolean(r.is_active),
      createdAt: String(r.created_at),
    }));
  });
}

/**
 * Deactivate a fleet lesson (soft delete).
 */
export async function deactivateFleetLesson(id: number): Promise<void> {
  await sql`
    UPDATE fleet_lessons SET is_active = false WHERE id = ${id}
  `;
}
