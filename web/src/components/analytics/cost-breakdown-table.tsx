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
        <h3 className="mb-2 text-sm font-medium text-text-secondary">
          By Model & Task
        </h3>
        {modelCosts.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-none border border-void-border bg-void-surface">
            <p className="text-xs text-text-tertiary">No cost data</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-none border border-void-border">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-void-border bg-void-surface hover:bg-void-surface">
                  <TableHead className="text-xs font-medium text-text-secondary">Model</TableHead>
                  <TableHead className="text-xs font-medium text-text-secondary">Task</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">Input Tokens</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">Output Tokens</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelCosts.map((m, i) => (
                  <TableRow key={i} className="h-10 hover:bg-void-muted">
                    <TableCell className="font-mono text-sm text-text-primary">
                      {m.model}
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-void-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                        {m.taskType}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-text-secondary">
                      {formatTokens(m.inputTokens)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-text-secondary">
                      {formatTokens(m.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-text-primary">
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
        <h3 className="mb-2 text-sm font-medium text-text-secondary">
          By Archetype
        </h3>
        {archetypeCosts.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-none border border-void-border bg-void-surface">
            <p className="text-xs text-text-tertiary">No cost data</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-none border border-void-border">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-void-border bg-void-surface hover:bg-void-surface">
                  <TableHead className="text-xs font-medium text-text-secondary">Archetype</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">Total Tokens</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">Total Cost</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">Cost/Trade</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archetypeCosts.map((a) => {
                  const costPerTrade = a.tradeCount > 0 ? a.totalCost / a.tradeCount : 0;
                  const roi = a.totalCost > 0 ? a.totalPnl / a.totalCost : 0;
                  return (
                    <TableRow key={a.archetype} className="h-10 hover:bg-void-muted">
                      <TableCell>
                        <span className="rounded bg-void-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                          {STRATEGY_ARCHETYPE_LABELS[a.archetype]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text-secondary">
                        {formatTokens(a.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-text-primary">
                        ${a.totalCost.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text-secondary">
                        {a.tradeCount > 0 ? `$${costPerTrade.toFixed(4)}` : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-semibold tabular-nums ${
                        roi > 0 ? "text-data-profit" : roi < 0 ? "text-data-loss" : "text-text-secondary"
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
