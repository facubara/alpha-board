"use client";

/**
 * LlmServicesPanel — Read-only grid of LLM section enabled/disabled indicators.
 * Terminal-style: monospace, rounded dots with glow, gap-px grid.
 */

import type { LlmSection } from "@/lib/types";

interface LlmServicesPanelProps {
  sections: LlmSection[];
}

export function LlmServicesPanel({ sections }: LlmServicesPanelProps) {
  if (sections.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-text-secondary">
        LLM Services
      </h2>
      <div className="grid grid-cols-2 gap-px border border-void-border bg-void-border sm:grid-cols-3">
        {sections.map((s) => (
          <div
            key={s.key}
            className="flex items-center gap-2 bg-void-surface px-3 py-2.5"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                s.enabled
                  ? "bg-data-profit shadow-[0_0_4px_rgba(16,185,129,0.4)]"
                  : "bg-data-loss shadow-[0_0_4px_rgba(244,63,94,0.4)]"
              }`}
            />
            <span className="truncate font-mono text-xs text-text-primary">
              {s.displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
