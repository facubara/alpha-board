"use client";

/**
 * ModelConfig Tab
 *
 * Three model dropdowns (scan, trade, evolution) + token usage breakdown.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentDetail, AgentTokenUsageSummary } from "@/lib/types";

interface ModelConfigProps {
  agent: AgentDetail;
  tokenUsage: AgentTokenUsageSummary[];
}

const AVAILABLE_MODELS = [
  "claude-haiku-3-5-20241022",
  "claude-sonnet-4-20250514",
  "claude-opus-4-5-20251101",
];

const MODEL_SHORT: Record<string, string> = {
  "claude-haiku-3-5-20241022": "Haiku 3.5",
  "claude-sonnet-4-20250514": "Sonnet 4",
  "claude-opus-4-5-20251101": "Opus 4.5",
};

function modelLabel(model: string): string {
  return MODEL_SHORT[model] ?? model;
}

export function ModelConfig({ agent, tokenUsage }: ModelConfigProps) {
  const [scanModel, setScanModel] = useState(agent.scanModel);
  const [tradeModel, setTradeModel] = useState(agent.tradeModel);
  const [evolutionModel, setEvolutionModel] = useState(agent.evolutionModel);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { requireAuth } = useAuth();

  const isDirty =
    scanModel !== agent.scanModel ||
    tradeModel !== agent.tradeModel ||
    evolutionModel !== agent.evolutionModel;

  const handleSave = () => {
    if (!isDirty || saving) return;
    requireAuth(async () => {
      setSaving(true);
      setSaved(false);
      try {
        const res = await fetch(`/api/agents/${agent.id}/models`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scan_model: scanModel,
            trade_model: tradeModel,
            evolution_model: evolutionModel,
          }),
        });
        if (res.ok) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
        setSaving(false);
      } catch {
        setSaving(false);
      }
    });
  };

  const totalCost = tokenUsage.reduce((s, u) => s + u.estimatedCostUsd, 0);

  return (
    <div className="space-y-6">
      {/* Save bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-secondary">Agent Configuration</h3>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-bullish">Saved</span>}
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

      {/* Model selectors */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-secondary">Model Assignments</h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <ModelSelect
            label="Scan Model"
            description="Routine market scans"
            value={scanModel}
            onChange={setScanModel}
          />
          <ModelSelect
            label="Trade Model"
            description="Trade entry/exit decisions"
            value={tradeModel}
            onChange={setTradeModel}
          />
          <ModelSelect
            label="Evolution Model"
            description="Strategy review & prompt evolution"
            value={evolutionModel}
            onChange={setEvolutionModel}
          />
        </div>
      </div>

      {/* Token usage breakdown */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-secondary">
          Token Usage
          <span className="ml-2 font-mono text-xs text-muted">
            Total: ${totalCost.toFixed(4)}
          </span>
        </h3>

        {tokenUsage.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <p className="text-xs text-muted">No token usage recorded</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
                  <TableHead className="text-xs font-medium text-secondary">Model</TableHead>
                  <TableHead className="text-xs font-medium text-secondary">Task</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Input</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Output</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokenUsage.map((u) => (
                  <TableRow key={`${u.model}-${u.taskType}`} className="h-10 hover:bg-[var(--bg-elevated)]">
                    <TableCell className="font-mono text-sm text-primary">
                      {modelLabel(u.model)}
                    </TableCell>
                    <TableCell className="text-sm capitalize text-secondary">
                      {u.taskType}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                      {u.inputTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                      {u.outputTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted">
                      ${u.estimatedCostUsd.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function ModelSelect({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <label className="block text-sm font-medium text-primary">{label}</label>
      <p className="mb-2 text-xs text-muted">{description}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1.5 font-mono text-xs text-primary outline-none focus:border-[var(--border-strong)]"
      >
        {AVAILABLE_MODELS.map((m) => (
          <option key={m} value={m}>
            {modelLabel(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
