/**
 * Status Page — System health dashboard.
 *
 * Server component with ISR 60s. Shows service status, 90-day heatmaps,
 * and recent incidents.
 */

import { PageHeader } from "@/components/terminal";
import { getStatusData } from "@/lib/queries/status";
import { getLlmSettings } from "@/lib/queries/settings";
import { StatusPage } from "@/components/status/status-page";

export const revalidate = 60;

export default async function StatusRoute() {
  let data: Awaited<ReturnType<typeof getStatusData>> | null;
  let llmSections: Awaited<ReturnType<typeof getLlmSettings>>;
  try {
    [data, llmSections] = await Promise.all([
      getStatusData(),
      getLlmSettings(),
    ]);
  } catch {
    // Worker may be down — show fallback
    data = null;
    llmSections = [];
  }

  return (
    <div className="space-y-6">
      <PageHeader title="System Status" subtitle="Real-time health monitoring for pipeline, agents, and services" />

      {data ? (
        <StatusPage data={data} llmSections={llmSections ?? []} />
      ) : (
        <div className="rounded-none border border-void-border bg-void-surface px-4 py-8 text-center text-sm text-text-tertiary">
          Unable to fetch status data. The worker API may be unavailable.
        </div>
      )}
    </div>
  );
}
