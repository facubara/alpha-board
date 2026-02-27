"use client";

/**
 * CostBreakdownTable — Model/task cost breakdown + archetype cost summary.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STRATEGY_ARCHETYPE_LABELS } from "@/lib/types";
import type { ModelCostBreakdown, ArchetypeCost } from "@/lib/types";

interface CostBreakdownTableProps {
  modelCosts: ModelCostBreakdown[];
  archetypeCosts: ArchetypeCost[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function CostBreakdownTable({
  modelCosts,
  archetypeCosts,
}: CostBreakdownTableProps) {
  return (
    <div className="space-y-6">
      {/* By Model & Task */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-secondary">
          By Model & Task
        </h3>
        {modelCosts.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <p className="text-xs text-muted">No cost data</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
                  <TableHead className="text-xs font-medium text-secondary">Model</TableHead>
                  <TableHead className="text-xs font-medium text-secondary">Task</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Input Tokens</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Output Tokens</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelCosts.map((m, i) => (
                  <TableRow key={i} className="h-10 hover:bg-[var(--bg-elevated)]">
                    <TableCell className="font-mono text-sm text-primary">
                      {m.model}
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-secondary">
                        {m.taskType}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                      {formatTokens(m.inputTokens)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                      {formatTokens(m.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-primary">
                      ${m.totalCost.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* By Archetype */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-secondary">
          By Archetype
        </h3>
        {archetypeCosts.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <p className="text-xs text-muted">No cost data</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
                  <TableHead className="text-xs font-medium text-secondary">Archetype</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Total Tokens</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Total Cost</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Cost/Trade</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archetypeCosts.map((a) => {
                  const costPerTrade = a.tradeCount > 0 ? a.totalCost / a.tradeCount : 0;
                  const roi = a.totalCost > 0 ? a.totalPnl / a.totalCost : 0;
                  return (
                    <TableRow key={a.archetype} className="h-10 hover:bg-[var(--bg-elevated)]">
                      <TableCell>
                        <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-secondary">
                          {STRATEGY_ARCHETYPE_LABELS[a.archetype]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                        {formatTokens(a.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-primary">
                        ${a.totalCost.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                        {a.tradeCount > 0 ? `$${costPerTrade.toFixed(4)}` : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-semibold tabular-nums ${
                        roi > 0 ? "text-bullish" : roi < 0 ? "text-bearish" : "text-secondary"
                      }`}>
                        {a.totalCost > 0 ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}x` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
