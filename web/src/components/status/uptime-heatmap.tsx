"use client";

/**
 * UptimeHeatmap — 90 small colored rectangles representing daily uptime.
 * Hover tooltip shows date, uptime %, and incident count.
 */

import { useState } from "react";
import type { ServiceDailyStatus } from "@/lib/types";

function uptimeColor(pct: number): string {
  if (pct >= 100) return "#22C55E"; // bullish-strong
  if (pct >= 99) return "#166534"; // bullish-muted
  if (pct >= 95) return "#FBBF24"; // neutral-strong
  if (pct >= 90) return "#991B1B"; // bearish-muted
  return "#EF4444"; // bearish-strong
}

const NO_DATA_COLOR = "#262626"; // bg-muted

interface UptimeHeatmapProps {
  daily: ServiceDailyStatus[];
}

export function UptimeHeatmap({ daily }: UptimeHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: ServiceDailyStatus;
  } | null>(null);

  // Build a map from date string to daily data
  const byDate = new Map(daily.map((d) => [d.date, d]));

  // Generate last 90 days (most recent on right)
  const days: { date: string; data: ServiceDailyStatus | null }[] = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({ date: dateStr, data: byDate.get(dateStr) ?? null });
  }

  return (
    <div className="relative">
      <div className="flex gap-[2px]">
        {days.map(({ date, data }) => (
          <div
            key={date}
            className="h-[14px] flex-1 rounded-[1px] transition-opacity hover:opacity-80"
            style={{
              backgroundColor: data
                ? uptimeColor(data.uptime_pct)
                : NO_DATA_COLOR,
              minWidth: "2px",
            }}
            onMouseEnter={(e) => {
              if (data) {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                  data,
                });
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-medium text-primary">{tooltip.data.date}</div>
          <div className="text-secondary">
            Uptime: {tooltip.data.uptime_pct.toFixed(2)}%
          </div>
          {tooltip.data.incidents > 0 && (
            <div className="text-[#FBBF24]">
              {tooltip.data.incidents} incident{tooltip.data.incidents > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
