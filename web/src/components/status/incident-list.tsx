"use client";

/**
 * IncidentList — Active incidents + resolved incidents from past 14 days.
 * Designed for constrained right-pane layout with terminal-style badges.
 */

import type { ServiceIncident, ServiceStatus } from "@/lib/types";

const STATUS_BADGE: Record<ServiceStatus, { label: string; className: string }> = {
  down: {
    label: "DOWN",
    className: "bg-data-loss/10 text-data-loss border-data-loss",
  },
  degraded: {
    label: "DEGRADED",
    className: "bg-terminal-amber/10 text-terminal-amber border-terminal-amber",
  },
  operational: {
    label: "RESOLVED",
    className: "bg-data-profit/10 text-data-profit border-data-profit",
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
  const activeIds = new Set(activeIncidents.map((i) => i.id));
  const resolved = recentIncidents.filter((i) => !activeIds.has(i.id) && i.resolvedAt);

  const groupedByDate = new Map<string, ServiceIncident[]>();
  for (const inc of resolved) {
    const dateKey = inc.startedAt.split("T")[0];
    const group = groupedByDate.get(dateKey) ?? [];
    group.push(inc);
    groupedByDate.set(dateKey, group);
  }

  const sortedDates = [...groupedByDate.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col gap-6">
      {/* Active incidents */}
      {activeIncidents.length > 0 && (
        <div>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-text-secondary">
            Active Incidents
          </h2>
          <div className="flex flex-col gap-2">
            {activeIncidents.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        </div>
      )}

      {/* Past incidents */}
      {sortedDates.length > 0 && (
        <div>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-text-secondary">
            Past Incidents
          </h2>
          <div className="flex flex-col gap-4">
            {sortedDates.map((dateKey) => (
              <div key={dateKey}>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
                  {formatDate(dateKey)}
                </div>
                <div className="flex flex-col gap-2">
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
        <div className="border border-void-border bg-void-surface px-4 py-6 text-center font-mono text-sm text-text-tertiary">
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
    <div className="border border-void-border bg-void-surface p-3 flex flex-col gap-2 hover:border-text-tertiary transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span
            className={`inline-flex self-start border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="font-mono text-sm text-text-primary truncate">
            {incident.serviceName}
          </span>
        </div>
        <span className="shrink-0 font-mono text-xs text-text-tertiary text-right">
          {formatTime(incident.startedAt)}
          {" · "}
          {formatDuration(incident.durationMinutes)}
        </span>
      </div>
      {incident.errorSummary && (
        <p className="font-mono text-xs text-text-tertiary leading-relaxed">{incident.errorSummary}</p>
      )}
    </div>
  );
}
