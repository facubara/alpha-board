"use client";

/**
 * SettingsPage — Client container with optimistic toggle state.
 */

import { useState, useCallback } from "react";
import type { LlmSection, LlmSectionCost } from "@/lib/types";
import { LlmSectionRow } from "./llm-section-row";
import { useAuth } from "@/components/auth/auth-provider";

interface SettingsPageProps {
  sections: LlmSection[];
  costs: LlmSectionCost[];
}

export function SettingsPage({ sections: initial, costs }: SettingsPageProps) {
  const [sections, setSections] = useState(initial);
  const { isAuthenticated, requireAuth } = useAuth();

  const costMap = new Map(costs.map((c) => [c.key, c]));

  const handleToggle = useCallback(
    (key: string) => {
      requireAuth(async () => {
        // Optimistic update
        setSections((prev) =>
          prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
        );

        try {
          const res = await fetch(`/api/settings/llm/${key}`, {
            method: "POST",
          });
          if (!res.ok) {
            // Revert on failure
            setSections((prev) =>
              prev.map((s) =>
                s.key === key ? { ...s, enabled: !s.enabled } : s
              )
            );
          }
        } catch {
          // Revert on error
          setSections((prev) =>
            prev.map((s) =>
              s.key === key ? { ...s, enabled: !s.enabled } : s
            )
          );
        }
      });
    },
    [requireAuth]
  );

  return (
    <div className="space-y-6">
      {/* LLM Sections */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-secondary">
          LLM Sections
        </h2>
        <div className="space-y-2">
          {sections.map((section) => (
            <LlmSectionRow
              key={section.key}
              section={section}
              cost={costMap.get(section.key) ?? null}
              onToggle={handleToggle}
              disabled={!isAuthenticated}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
