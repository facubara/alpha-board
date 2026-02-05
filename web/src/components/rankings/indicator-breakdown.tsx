/**
 * IndicatorBreakdown Component
 *
 * Expandable section showing per-indicator signal breakdown.
 * Per DESIGN_SYSTEM.md:
 * - Shows mini score bar per indicator
 * - Signal value displayed as +0.XX or -0.XX
 * - Description text in text-muted
 */

import { cn } from "@/lib/utils";
import type { IndicatorSignal } from "@/lib/types";

interface IndicatorBreakdownProps {
  signals: IndicatorSignal[];
  className?: string;
}

/**
 * Get fill color class based on signal value (-1 to +1).
 */
function getSignalColor(signal: number): string {
  if (signal < -0.2) return "bg-[var(--bearish-strong)]";
  if (signal > 0.2) return "bg-[var(--bullish-strong)]";
  return "bg-[var(--text-muted)]";
}

/**
 * Get text color class based on signal value.
 */
function getSignalTextColor(signal: number): string {
  if (signal < -0.2) return "text-bearish";
  if (signal > 0.2) return "text-bullish";
  return "text-muted";
}

/**
 * Format signal value with sign.
 */
function formatSignal(signal: number): string {
  const sign = signal >= 0 ? "+" : "";
  return `${sign}${signal.toFixed(2)}`;
}

export function IndicatorBreakdown({
  signals,
  className,
}: IndicatorBreakdownProps) {
  if (!signals || signals.length === 0) {
    return (
      <div className={cn("py-3 text-sm text-muted", className)}>
        No indicator data available
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 py-3", className)}>
      {signals.map((indicator) => (
        <div
          key={indicator.name}
          className="grid grid-cols-[140px_120px_60px_1fr] items-center gap-4 text-sm"
        >
          {/* Indicator name */}
          <span className="text-secondary truncate">
            {indicator.displayName}
          </span>

          {/* Mini score bar (signal normalized to 0-1 for display) */}
          <div className="flex items-center gap-2">
            <div className="relative h-1 w-16 overflow-hidden rounded-full bg-[var(--bg-muted)]">
              {/* Center line at 50% representing 0 */}
              <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--border-default)]" />

              {/* Fill from center based on signal direction */}
              {indicator.signal >= 0 ? (
                <div
                  className={cn(
                    "absolute top-0 h-full rounded-r-full",
                    getSignalColor(indicator.signal)
                  )}
                  style={{
                    left: "50%",
                    width: `${Math.abs(indicator.signal) * 50}%`,
                  }}
                />
              ) : (
                <div
                  className={cn(
                    "absolute top-0 h-full rounded-l-full",
                    getSignalColor(indicator.signal)
                  )}
                  style={{
                    right: "50%",
                    width: `${Math.abs(indicator.signal) * 50}%`,
                  }}
                />
              )}
            </div>
          </div>

          {/* Signal value */}
          <span
            className={cn(
              "font-mono text-xs font-medium tabular-nums",
              getSignalTextColor(indicator.signal)
            )}
          >
            {formatSignal(indicator.signal)}
          </span>

          {/* Description */}
          <span className="truncate text-xs text-muted">
            {indicator.description}
          </span>
        </div>
      ))}
    </div>
  );
}
