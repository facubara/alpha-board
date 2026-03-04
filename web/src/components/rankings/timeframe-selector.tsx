"use client";

/**
 * TimeframeSelector Component
 *
 * Tab-style selector for switching between timeframes.
 * Terminal aesthetic: sharp edges, no rounded corners, amber accent.
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
              "rounded-none px-3 py-2 font-mono text-sm font-medium transition-colors-fast",
              isSelected
                ? "border border-void-border bg-void-surface text-text-primary"
                : "border border-transparent text-text-secondary hover:bg-void-muted hover:text-text-primary"
            )}
          >
            {tf}
          </button>
        );
      })}
    </div>
  );
}
