"use client";

/**
 * StatusPage — Main container for status dashboard.
 * Split-pane layout: monitors on left, incident logs on right.
 */

import type { LlmSection, StatusData } from "@/lib/types";
import { StatusBanner } from "./status-banner";
import { ServiceRow } from "./service-row";
import { IncidentList } from "./incident-list";
import { LlmServicesPanel } from "./llm-services-panel";

interface StatusPageProps {
  data: StatusData;
  llmSections: LlmSection[];
}

export function StatusPage({ data, llmSections }: StatusPageProps) {
  const historyBySlug = new Map(
    data.history.map((h) => [h.slug, h])
  );

  return (
    <div className="space-y-6">
      <StatusBanner overall={data.overall} />

      {/* Split-pane: monitors left, incident logs right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
        {/* Left Pane — Monitors */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* LLM Services panel */}
          {llmSections.length > 0 && <LlmServicesPanel sections={llmSections} />}

          {/* Service rows — outer border wrapper, inner items use border-b */}
          <div className="border border-void-border">
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
              <div className="px-4 py-8 text-center font-mono text-sm text-text-tertiary">
                No health checks recorded yet. Data will appear after the first check cycle (~2 minutes).
              </div>
            )}
          </div>
        </div>

        {/* Right Pane — Incident Logs (fixed height, scrollable) */}
        <div className="lg:col-span-4 h-[calc(100vh-250px)] overflow-y-auto terminal-scroll pr-4">
          <IncidentList
            activeIncidents={data.activeIncidents}
            recentIncidents={data.recentIncidents}
          />
        </div>
      </div>
    </div>
  );
}
