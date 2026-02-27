/**
 * Shared Recharts theme constants for consistent chart styling.
 */

import type { CSSProperties } from "react";

/** Recharts tick prop expects SVG attributes, not CSSProperties */
export const AXIS_TICK_STYLE = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 10,
  fill: "var(--text-muted)",
};

export const GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: "var(--border-subtle)",
  vertical: false,
} as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border-default)",
    borderRadius: 6,
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    color: "var(--text-secondary)",
    padding: "6px 10px",
  } satisfies CSSProperties,
  cursor: { stroke: "var(--border-subtle)", strokeDasharray: "3 3" },
  itemStyle: { color: "var(--text-secondary)", padding: 0 } satisfies CSSProperties,
  labelStyle: { color: "var(--text-muted)", marginBottom: 2, fontSize: 10 } satisfies CSSProperties,
};

export const CHART_COLORS = {
  bullish: "var(--bullish-strong)",
  bearish: "var(--bearish-strong)",
  amber: "#F59E0B",
} as const;

/** Format number as $X,XXX */
export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const prefix = value < 0 ? "-$" : "$";
  if (abs >= 1000) return `${prefix}${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (abs >= 1) return `${prefix}${abs.toFixed(2)}`;
  return `${prefix}${abs.toFixed(4)}`;
}

/** Format date string (YYYY-MM-DD) to "Jan 15" */
export function formatDateTick(day: string): string {
  const d = new Date(day + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Format ms timestamp to "Jan 15" */
export function formatTimestampTick(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
