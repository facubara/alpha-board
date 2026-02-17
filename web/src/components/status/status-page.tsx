"use client";

/**
 * StatusPage — Main container for status dashboard.
 * Renders overall banner, service rows, and incident lists.
 */

import type { StatusData } from "@/lib/types";
import { StatusBanner } from "./status-banner";
import { ServiceRow } from "./service-row";
import { IncidentList } from "./incident-list";

interface StatusPageProps {
  data: StatusData;
}

export function StatusPage({ data }: StatusPageProps) {
  // Build a lookup from history by slug for service rows
  const historyBySlug = new Map(
    data.history.map((h) => [h.slug, h])
  );

  return (
    <div className="space-y-6">
      <StatusBanner overall={data.overall} />

      {/* Service rows */}
      <div className="space-y-2">
        {data.services.map((svc) => {
          const history = historyBySlug.get(svc.slug);
          return (
            <ServiceRow
              key={svc.slug}
              service={svc}
              history={history ?? null}
            />
          );
        })}

        {data.services.length === 0 && (
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-8 text-center text-sm text-muted">
            No health checks recorded yet. Data will appear after the first check cycle (~2 minutes).
          </div>
        )}
      </div>

      {/* Incidents */}
      <IncidentList
        activeIncidents={data.activeIncidents}
        recentIncidents={data.recentIncidents}
      />
    </div>
  );
}
