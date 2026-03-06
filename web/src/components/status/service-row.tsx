"use client";

/**
 * ServiceRow — Single service with glowing status dot, name, latency,
 * 90-day heatmap, and uptime percentage.
 */

import type { ServiceCurrent, ServiceHistory, ServiceStatus } from "@/lib/types";
import { UptimeHeatmap } from "./uptime-heatmap";

const STATUS_DOT: Record<ServiceStatus, string> = {
  operational: "bg-data-profit shadow-[0_0_4px_rgba(16,185,129,0.4)]",
  degraded: "bg-terminal-amber shadow-[0_0_4px_rgba(255,176,0,0.4)]",
  down: "bg-data-loss animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.6)]",
};

interface ServiceRowProps {
  service: ServiceCurrent;
  history: ServiceHistory | null;
}

export function ServiceRow({ service, history }: ServiceRowProps) {
  const dotClass = STATUS_DOT[service.status] ?? "bg-text-tertiary";

  return (
    <div className="border-b border-void-border bg-void-surface px-4 py-3 last:border-b-0">
      {/* Top line: status dot + name + latency + uptime */}
      <div className="flex items-center gap-3">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
          title={service.status}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-primary">
          {service.name}
        </span>
        {service.latency_ms != null && (
          <span className="shrink-0 font-mono text-xs text-text-secondary">
            {service.latency_ms}ms
          </span>
        )}
        {history?.uptime_90d != null && (
          <span className="shrink-0 font-mono text-xs text-text-secondary">
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
