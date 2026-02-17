"use client";

/**
 * ServiceRow — Single service with status dot, name, latency,
 * 90-day heatmap, and uptime percentage.
 */

import type { ServiceCurrent, ServiceHistory, ServiceStatus } from "@/lib/types";
import { UptimeHeatmap } from "./uptime-heatmap";

const STATUS_DOT: Record<ServiceStatus, string> = {
  operational: "bg-[#22C55E]",
  degraded: "bg-[#FBBF24]",
  down: "bg-[#EF4444]",
};

interface ServiceRowProps {
  service: ServiceCurrent;
  history: ServiceHistory | null;
}

export function ServiceRow({ service, history }: ServiceRowProps) {
  const dotClass = STATUS_DOT[service.status] ?? "bg-[#525252]";

  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
      {/* Top line: status dot + name + latency + uptime */}
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
          title={service.status}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
          {service.name}
        </span>
        {service.latency_ms != null && (
          <span className="shrink-0 text-xs text-muted">
            {service.latency_ms}ms
          </span>
        )}
        {history?.uptime_90d != null && (
          <span className="shrink-0 text-xs font-medium text-secondary">
            {history.uptime_90d.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Heatmap */}
      {history && (
        <div className="mt-2">
          <UptimeHeatmap daily={history.daily} />
        </div>
      )}
    </div>
  );
}
