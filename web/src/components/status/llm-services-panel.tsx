"use client";

/**
 * LlmServicesPanel — Read-only grid of LLM section enabled/disabled badges
 * for the Status page. No toggles, no costs — just a quick glance.
 */

import type { LlmSection } from "@/lib/types";

interface LlmServicesPanelProps {
  sections: LlmSection[];
}

export function LlmServicesPanel({ sections }: LlmServicesPanelProps) {
  if (sections.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-secondary">
        LLM Services
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sections.map((s) => (
          <div
            key={s.key}
            className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                s.enabled ? "bg-[#22C55E]" : "bg-[#EF4444]"
              }`}
            />
            <span className="truncate text-xs font-medium text-primary">
              {s.displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
