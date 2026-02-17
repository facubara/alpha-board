/**
 * Status Queries
 *
 * Fetches service health data from the worker API.
 */

import { cached } from "@/lib/cache";
import type { StatusData, ServiceCurrent, ServiceHistory, ServiceIncident } from "@/lib/types";

const WORKER_URL = "https://alpha-worker.fly.dev";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Worker API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch all status data in parallel: current services, history, incidents.
 */
export async function getStatusData(): Promise<StatusData> {
  return cached("status:data", 60, async () => {
    const [currentData, historyData, incidentsData] = await Promise.all([
      fetchJson<{
        overall: StatusData["overall"];
        services: ServiceCurrent[];
        active_incidents: ServiceIncident[];
      }>("/status/services"),
      fetchJson<{ services: ServiceHistory[] }>("/status/history?days=90"),
      fetchJson<ServiceIncident[]>("/status/incidents?days=14"),
    ]);

    return {
      overall: currentData.overall,
      services: currentData.services,
      activeIncidents: currentData.active_incidents,
      history: historyData.services,
      recentIncidents: incidentsData,
    };
  });
}
