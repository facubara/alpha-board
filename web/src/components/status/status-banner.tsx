"use client";

/**
 * StatusBanner — Overall system status indicator.
 * Terminal-style: 1px border, 10% opacity bg, monospace uppercase.
 */

import type { ServiceStatus } from "@/lib/types";
import { DottedLoader } from "@/components/terminal";

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; border: string; text: string; loaderColor: string }
> = {
  operational: {
    label: "All Systems Operational",
    border: "border-data-profit",
    text: "text-data-profit",
    loaderColor: "bg-data-profit",
  },
  degraded: {
    label: "Partial System Degradation",
    border: "border-terminal-amber",
    text: "text-terminal-amber",
    loaderColor: "bg-terminal-amber",
  },
  down: {
    label: "Service Disruption",
    border: "border-data-loss",
    text: "text-data-loss",
    loaderColor: "bg-data-loss",
  },
};

interface StatusBannerProps {
  overall: ServiceStatus;
}

export function StatusBanner({ overall }: StatusBannerProps) {
  const config = STATUS_CONFIG[overall];

  return (
    <div
      className={`flex items-center gap-3 border ${config.border} ${config.text} bg-current/10 p-4`}
      style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}
    >
      <DottedLoader color={config.loaderColor} />
      <span className="font-mono text-sm uppercase tracking-widest">
        {config.label}
      </span>
    </div>
  );
}
