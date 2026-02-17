import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a timestamp as relative time (e.g., "2m ago", "1h ago").
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

const SHORT_DT_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/**
 * Format a timestamp for display: UTC as primary text, local time in tooltip.
 * Returns { utc, local, iso } so callers can render both.
 */
export function formatTimestamp(timestamp: string | Date): {
  utc: string;
  local: string;
  iso: string;
} {
  const date =
    typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const utc = date.toLocaleString("en-US", { ...SHORT_DT_OPTS, timeZone: "UTC" }) + " UTC";
  const local = date.toLocaleString("en-US", SHORT_DT_OPTS);
  return { utc, local, iso: date.toISOString() };
}
