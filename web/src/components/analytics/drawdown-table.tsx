"use client";

/**
 * DrawdownTable — Agents currently in drawdown.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STRATEGY_ARCHETYPE_LABELS, AGENT_TIMEFRAME_LABELS } from "@/lib/types";
import type { AgentDrawdown } from "@/lib/types";

interface DrawdownTableProps {
  data: AgentDrawdown[];
}

export function DrawdownTable({ data }: DrawdownTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <p className="text-xs text-muted">No agents in drawdown</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
            <TableHead className="text-xs font-medium text-secondary">Agent</TableHead>
            <TableHead className="text-xs font-medium text-secondary">Archetype</TableHead>
            <TableHead className="text-xs font-medium text-secondary">TF</TableHead>
            <TableHead className="text-right text-xs font-medium text-secondary">Peak</TableHead>
            <TableHead className="text-right text-xs font-medium text-secondary">Current</TableHead>
            <TableHead className="text-right text-xs font-medium text-secondary">Drawdown</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((d) => (
            <TableRow key={d.id} className="h-10 hover:bg-[var(--bg-elevated)]">
              <TableCell>
                <Link
                  href={`/agents/${d.id}`}
                  className="font-mono text-sm font-semibold text-primary hover:underline"
                >
                  {d.displayName}
                </Link>
              </TableCell>
              <TableCell>
                <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-secondary">
                  {STRATEGY_ARCHETYPE_LABELS[d.archetype]}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted">
                {AGENT_TIMEFRAME_LABELS[d.timeframe]}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                ${d.peakEquity.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                ${d.totalEquity.toFixed(2)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono text-sm font-semibold tabular-nums text-bearish"
                )}
              >
                {d.drawdownPct.toFixed(2)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
