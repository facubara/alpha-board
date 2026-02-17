"use client";

/**
 * IncidentList — Active incidents + resolved incidents from past 14 days.
 * Grouped by date.
 */

import type { ServiceIncident, ServiceStatus } from "@/lib/types";

const STATUS_BADGE: Record<ServiceStatus, { label: string; className: string }> = {
  down: {
    label: "Down",
    className: "bg-[#991B1B]/30 text-[#EF4444] border-[#991B1B]",
  },
  degraded: {
    label: "Degraded",
    className: "bg-[#92400E]/30 text-[#FBBF24] border-[#92400E]",
  },
  operational: {
    label: "Resolved",
    className: "bg-[#166534]/30 text-[#22C55E] border-[#166534]",
  },
};

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "ongoing";
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface IncidentListProps {
  activeIncidents: ServiceIncident[];
  recentIncidents: ServiceIncident[];
}

export function IncidentList({ activeIncidents, recentIncidents }: IncidentListProps) {
  // Resolved incidents (exclude active ones)
  const activeIds = new Set(activeIncidents.map((i) => i.id));
  const resolved = recentIncidents.filter((i) => !activeIds.has(i.id) && i.resolvedAt);

  // Group resolved by date
  const groupedByDate = new Map<string, ServiceIncident[]>();
  for (const inc of resolved) {
    const dateKey = inc.startedAt.split("T")[0];
    const group = groupedByDate.get(dateKey) ?? [];
    group.push(inc);
    groupedByDate.set(dateKey, group);
  }

  const sortedDates = [...groupedByDate.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {/* Active incidents */}
      {activeIncidents.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-primary">
            Active Incidents
          </h2>
          <div className="space-y-2">
            {activeIncidents.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        </div>
      )}

      {/* Past incidents */}
      {sortedDates.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-primary">
            Past Incidents
          </h2>
          <div className="space-y-4">
            {sortedDates.map((dateKey) => (
              <div key={dateKey}>
                <div className="mb-1.5 text-xs font-medium text-muted">
                  {formatDate(dateKey)}
                </div>
                <div className="space-y-2">
                  {groupedByDate.get(dateKey)!.map((inc) => (
                    <IncidentCard key={inc.id} incident={inc} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeIncidents.length === 0 && sortedDates.length === 0 && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-muted">
          No incidents in the past 14 days.
        </div>
      )}
    </div>
  );
}

function IncidentCard({ incident }: { incident: ServiceIncident }) {
  const isActive = !incident.resolvedAt;
  const badge = isActive
    ? STATUS_BADGE[incident.status]
    : STATUS_BADGE.operational;

  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
        <span className="text-sm font-medium text-primary">
          {incident.serviceName}
        </span>
        <span className="ml-auto text-xs text-muted">
          {formatTime(incident.startedAt)}
          {" · "}
          {formatDuration(incident.durationMinutes)}
        </span>
      </div>
      {incident.errorSummary && (
        <p className="mt-1 text-xs text-muted">{incident.errorSummary}</p>
      )}
    </div>
  );
}
