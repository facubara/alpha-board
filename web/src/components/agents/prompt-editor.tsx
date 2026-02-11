"use client";

/**
 * PromptEditor Component
 *
 * Textarea for editing the agent's active strategy prompt.
 * Saves via POST /api/agents/[agentId]/prompt.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { Textarea } from "@/components/ui/textarea";
import type { AgentPromptVersion } from "@/lib/types";

interface PromptEditorProps {
  agentId: number;
  activePrompt: AgentPromptVersion | null;
}

export function PromptEditor({ agentId, activePrompt }: PromptEditorProps) {
  const [value, setValue] = useState(activePrompt?.systemPrompt ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { requireAuth } = useAuth();

  const isDirty = value !== (activePrompt?.systemPrompt ?? "");

  const handleSave = () => {
    if (!isDirty || saving) return;

    requireAuth(async () => {
      setSaving(true);
      setSaved(false);
      try {
        const res = await fetch(`/api/agents/${agentId}/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ system_prompt: value }),
        });
        if (res.ok) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-secondary">Active Prompt</h3>
          {activePrompt && (
            <span className="font-mono text-xs text-muted">
              v{activePrompt.version} · {activePrompt.source}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-bullish">Saved</span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors-fast",
              isDirty
                ? "bg-[var(--bg-surface)] text-primary hover:bg-[var(--bg-elevated)]"
                : "cursor-not-allowed text-muted",
              saving && "opacity-50"
            )}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[400px] resize-y font-mono text-xs leading-relaxed"
        placeholder="Enter strategy prompt..."
      />
    </div>
  );
}
