/**
 * Status Page — System health dashboard.
 *
 * Server component with ISR 60s. Shows service status, 90-day heatmaps,
 * and recent incidents.
 */

import { getStatusData } from "@/lib/queries/status";
import { StatusPage } from "@/components/status/status-page";

export const revalidate = 60;

export default async function StatusRoute() {
  let data;
  try {
    data = await getStatusData();
  } catch {
    // Worker may be down — show fallback
    data = null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">System Status</h1>
        <p className="mt-1 text-sm text-muted">
          Operational health of all Alpha Board services
        </p>
      </div>

      {data ? (
        <StatusPage data={data} />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-muted">
          Unable to fetch status data. The worker API may be unavailable.
        </div>
      )}
    </div>
  );
}
