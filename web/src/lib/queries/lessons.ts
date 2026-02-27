/**
 * Fleet Lessons Queries
 *
 * Fetches and manages fleet lessons from the worker API.
 */

import { cached } from "@/lib/cache";
import { workerGet, workerPost } from "@/lib/worker-client";
import type { FleetLesson } from "@/lib/types";

/**
 * Fetch all active fleet lessons joined with agent name.
 */
export function getFleetLessons(): Promise<FleetLesson[]> {
  return cached("fleet:lessons", 120, async () => {
    return workerGet<FleetLesson[]>("/lessons");
  });
}

/**
 * Deactivate a fleet lesson (soft delete).
 */
export async function deactivateFleetLesson(id: number): Promise<void> {
  await workerPost(`/lessons/${id}/deactivate`);
}
