"use client";

/**
 * TimeframeSelector Component
 *
 * Tab-style selector for switching between timeframes.
 * Per DESIGN_SYSTEM.md:
 * - Container: Inline flex, gap: 4px
 * - Button padding: 8px 12px
 * - Font: text-sm, weight 500, mono
 * - Default: bg transparent, text text-secondary
 * - Hover: bg bg-elevated, text text-primary
 * - Selected: bg bg-surface, border border-strong, text text-primary
 * - Border radius: 6px
 */

import { cn } from "@/lib/utils";
import { TIMEFRAMES, type Timeframe } from "@/lib/types";

interface TimeframeSelectorProps {
  selected: Timeframe;
  onSelect: (timeframe: Timeframe) => void;
  className?: string;
}

export function TimeframeSelector({
  selected,
  onSelect,
  className,
}: TimeframeSelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Select timeframe"
      className={cn("inline-flex gap-1", className)}
    >
      {TIMEFRAMES.map((tf) => {
        const isSelected = tf === selected;

        return (
          <button
            key={tf}
            role="tab"
            aria-selected={isSelected}
            aria-controls={`rankings-panel-${tf}`}
            onClick={() => onSelect(tf)}
            className={cn(
              "rounded-md px-3 py-2 font-mono text-sm font-medium transition-colors-fast",
              isSelected
                ? "border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                : "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            )}
          >
            {tf}
          </button>
        );
      })}
    </div>
  );
}
