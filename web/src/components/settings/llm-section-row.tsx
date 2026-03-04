"use client";

/**
 * LlmSectionRow — Per-section card with toggle, badge, description, and cost.
 */

import type { LlmSection, LlmSectionCost } from "@/lib/types";

interface LlmSectionRowProps {
  section: LlmSection;
  cost: LlmSectionCost | null;
  onToggle: (key: string) => void;
  disabled: boolean;
}

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function LlmSectionRow({
  section,
  cost,
  onToggle,
  disabled,
}: LlmSectionRowProps) {
  return (
    <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
      {/* Top line: toggle + name + badge */}
      <div className="flex items-center gap-3">
        {/* Toggle button */}
        <button
          onClick={() => onToggle(section.key)}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:cursor-not-allowed disabled:opacity-50 ${
            section.enabled
              ? "bg-[#10B981]"
              : "bg-void-muted"
          }`}
          role="switch"
          aria-checked={section.enabled}
          aria-label={`Toggle ${section.displayName}`}
        >
          <span
            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
              section.enabled ? "translate-x-[18px]" : "translate-x-[3px]"
            }`}
          />
        </button>

        {/* Name */}
        <span className="min-w-0 flex-1 text-sm font-medium text-text-primary">
          {section.displayName}
        </span>

        {/* Enabled/Disabled badge */}
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            section.enabled
              ? "bg-[#10B981]/15 text-[#10B981]"
              : "bg-[#F43F5E]/15 text-[#F43F5E]"
          }`}
        >
          {section.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {/* Description */}
      <p className="mt-1.5 pl-12 text-xs text-text-tertiary">{section.description}</p>

      {/* Cost breakdown */}
      <div className="mt-1.5 pl-12 text-xs text-text-tertiary">
        {section.hasApiCost ? (
          cost ? (
            <span>
              All-time: {formatCost(cost.costAlltime)} &middot; 30d:{" "}
              {formatCost(cost.cost30d)}
            </span>
          ) : (
            <span>All-time: $0.0000 &middot; 30d: $0.0000</span>
          )
        ) : (
          <span className="italic">No API cost</span>
        )}
      </div>
    </div>
  );
}
