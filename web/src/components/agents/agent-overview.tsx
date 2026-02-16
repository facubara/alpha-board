"use client";

/**
 * AgentOverview Tab
 *
 * Equity curve, key metrics grid, and open positions table.
 */

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentDetail, AgentTrade, AgentPosition } from "@/lib/types";
import { EquityChart } from "./equity-chart";

interface AgentOverviewProps {
  agent: AgentDetail;
  trades: AgentTrade[];
  positions: AgentPosition[];
}

function formatUsd(value: number, showSign = false): string {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function AgentOverview({
  agent,
  trades,
  positions,
}: AgentOverviewProps) {
  const metrics = [
    {
      label: "Total PnL",
      value: formatUsd(agent.totalPnl, true),
      color:
        agent.totalPnl > 0
          ? "text-bullish"
          : agent.totalPnl < 0
            ? "text-bearish"
            : "text-secondary",
    },
    {
      label: "Return",
      value:
        agent.initialBalance > 0
          ? `${((agent.totalPnl / agent.initialBalance) * 100).toFixed(2)}%`
          : "—",
      color:
        agent.totalPnl > 0
          ? "text-bullish"
          : agent.totalPnl < 0
            ? "text-bearish"
            : "text-secondary",
    },
    { label: "Win Rate", value: agent.tradeCount > 0 ? formatPercent(agent.winRate) : "—", color: "text-primary" },
    { label: "Total Trades", value: String(agent.tradeCount), color: "text-primary" },
    { label: "Equity", value: formatUsd(agent.totalEquity), color: "text-primary" },
    { label: "Cash", value: formatUsd(agent.cashBalance), color: "text-secondary" },
    { label: "Fees Paid", value: formatUsd(agent.totalFeesPaid), color: "text-muted" },
    { label: "Token Cost", value: agent.engine === "rule" ? "—" : formatUsd(agent.totalTokenCost), color: "text-muted" },
  ];

  return (
    <div className="space-y-6">
      {/* Equity curve */}
      <EquityChart
        trades={trades}
        initialBalance={agent.initialBalance}
      />

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2"
          >
            <p className="text-xs text-muted">{m.label}</p>
            <p className={cn("font-mono text-lg font-semibold", m.color)}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Open positions */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-secondary">
          Open Positions ({positions.length})
        </h3>
        {positions.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <p className="text-xs text-muted">No open positions</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
                  <TableHead className="text-xs font-medium text-secondary">Symbol</TableHead>
                  <TableHead className="text-xs font-medium text-secondary">Dir</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Entry</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">Size</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">SL</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">TP</TableHead>
                  <TableHead className="text-right text-xs font-medium text-secondary">uPnL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((pos) => (
                  <TableRow key={pos.id} className="h-10 hover:bg-[var(--bg-elevated)]">
                    <TableCell className="font-mono text-sm font-semibold text-primary">
                      {pos.symbol}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs font-medium",
                          pos.direction === "long"
                            ? "bg-[var(--bullish-subtle)] text-bullish"
                            : "bg-[var(--bearish-subtle)] text-bearish"
                        )}
                      >
                        {pos.direction.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                      {pos.entryPrice.toPrecision(6)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                      ${pos.positionSize.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted">
                      {pos.stopLoss ? pos.stopLoss.toPrecision(6) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted">
                      {pos.takeProfit ? pos.takeProfit.toPrecision(6) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-sm font-semibold tabular-nums",
                        pos.unrealizedPnl > 0 && "text-bullish",
                        pos.unrealizedPnl < 0 && "text-bearish",
                        pos.unrealizedPnl === 0 && "text-secondary"
                      )}
                    >
                      {pos.unrealizedPnl >= 0 ? "+" : ""}
                      {pos.unrealizedPnl.toFixed(2)}
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
