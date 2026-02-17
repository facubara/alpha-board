"use client";

/**
 * StatusBanner — Overall system status indicator.
 */

import type { ServiceStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; bg: string; border: string; dot: string }
> = {
  operational: {
    label: "All Systems Operational",
    bg: "bg-[#166534]/20",
    border: "border-[#166534]",
    dot: "bg-[#22C55E]",
  },
  degraded: {
    label: "Partial System Degradation",
    bg: "bg-[#92400E]/20",
    border: "border-[#92400E]",
    dot: "bg-[#FBBF24]",
  },
  down: {
    label: "Service Disruption",
    bg: "bg-[#991B1B]/20",
    border: "border-[#991B1B]",
    dot: "bg-[#EF4444]",
  },
};

interface StatusBannerProps {
  overall: ServiceStatus;
}

export function StatusBanner({ overall }: StatusBannerProps) {
  const config = STATUS_CONFIG[overall];

  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-4 py-3 ${config.bg} ${config.border}`}
    >
      <span className={`h-3 w-3 shrink-0 rounded-full ${config.dot}`} />
      <span className="text-sm font-medium text-primary">{config.label}</span>
    </div>
  );
}
