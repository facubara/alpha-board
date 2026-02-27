/**
 * Status Queries
 *
 * Fetches service health data from the worker API.
 */

import { cached } from "@/lib/cache";
import { workerGet } from "@/lib/worker-client";
import type { StatusData, ServiceCurrent, ServiceHistory, ServiceIncident } from "@/lib/types";

/**
 * Fetch all status data in parallel: current services, history, incidents.
 */
export async function getStatusData(): Promise<StatusData> {
  return cached("status:data", 60, async () => {
    const [currentData, historyData, incidentsData] = await Promise.all([
      workerGet<{
        overall: StatusData["overall"];
        services: ServiceCurrent[];
        active_incidents: ServiceIncident[];
      }>("/status/services"),
      workerGet<{ services: ServiceHistory[] }>("/status/history?days=90"),
      workerGet<ServiceIncident[]>("/status/incidents?days=14"),
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
