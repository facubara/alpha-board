"use client";

/**
 * AgentOverview Tab
 *
 * Equity curve, key metrics grid, and open positions table with live uPnL.
 */

import { cn, formatTimestamp } from "@/lib/utils";
import { calculatePositionUpnl } from "@/hooks/use-live-upnl";
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

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface AgentOverviewProps {
  agent: AgentDetail;
  trades: AgentTrade[];
  positions: AgentPosition[];
  prices: Map<string, number>;
  pricesReady: boolean;
  displayTotalPnl?: number;
  displayEquity?: number;
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
  prices,
  pricesReady,
  displayTotalPnl,
  displayEquity,
}: AgentOverviewProps) {
  const totalPnl = displayTotalPnl ?? agent.totalPnl;
  const equity = displayEquity ?? agent.totalEquity;

  // Calculate live uPnL sum for the metrics grid
  let liveUpnlSum: number | undefined = undefined;
  if (pricesReady && positions.length === 0) {
    liveUpnlSum = 0;
  } else if (pricesReady) {
    let sum = 0;
    let allPriced = true;
    for (const pos of positions) {
      const pnl = calculatePositionUpnl(pos, prices.get(pos.symbol));
      if (pnl === undefined) {
        allPriced = false;
        break;
      }
      sum += pnl;
    }
    if (allPriced) liveUpnlSum = sum;
  }

  // Use the display upnl derived from live equity calc (passed from parent)
  // For the metrics grid, we use the totalPnl - realized to get display upnl
  const displayUpnl = totalPnl - agent.totalRealizedPnl;
  const hasLiveData = pricesReady && liveUpnlSum !== undefined;

  const metrics = [
    {
      label: "Realized PnL",
      value: formatUsd(agent.totalRealizedPnl, true),
      color:
        agent.totalRealizedPnl > 0
          ? "text-data-profit"
          : agent.totalRealizedPnl < 0
            ? "text-data-loss"
            : "text-text-secondary",
    },
    {
      label: "uPnL",
      value: hasLiveData ? formatUsd(displayUpnl, true) : SPINNER_FRAMES[0],
      color: !hasLiveData
        ? "text-text-tertiary"
        : displayUpnl > 0
          ? "text-data-profit"
          : displayUpnl < 0
            ? "text-data-loss"
            : "text-text-secondary",
    },
    {
      label: "Total PnL",
      value: formatUsd(totalPnl, true),
      color:
        totalPnl > 0
          ? "text-data-profit"
          : totalPnl < 0
            ? "text-data-loss"
            : "text-text-secondary",
    },
    {
      label: "Return",
      value:
        agent.initialBalance > 0
          ? `${((totalPnl / agent.initialBalance) * 100).toFixed(2)}%`
          : "—",
      color:
        totalPnl > 0
          ? "text-data-profit"
          : totalPnl < 0
            ? "text-data-loss"
            : "text-text-secondary",
    },
    { label: "Win Rate", value: agent.tradeCount > 0 ? formatPercent(agent.winRate) : "—", color: "text-text-primary" },
    { label: "Total Trades", value: String(agent.tradeCount), color: "text-text-primary" },
    { label: "Equity", value: formatUsd(equity), color: "text-text-primary" },
    { label: "Cash", value: formatUsd(agent.cashBalance), color: "text-text-secondary" },
    { label: "Fees Paid", value: formatUsd(agent.totalFeesPaid), color: "text-text-tertiary" },
    { label: "Token Cost", value: agent.engine === "rule" ? "—" : formatUsd(agent.totalTokenCost), color: "text-text-tertiary" },
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
            className="rounded-none border border-void-border bg-void-surface px-3 py-2"
          >
            <p className="text-xs text-text-tertiary">{m.label}</p>
            <p className={cn("font-mono text-lg font-semibold", m.color)}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Open positions */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-text-secondary">
          Open Positions ({positions.length})
        </h3>
        {positions.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-none border border-void-border bg-void-surface">
            <p className="text-xs text-text-tertiary">No open positions</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-none border border-void-border">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-void-border bg-void-surface hover:bg-void-surface">
                  <TableHead className="text-xs font-medium text-text-secondary">Symbol</TableHead>
                  <TableHead className="text-xs font-medium text-text-secondary">Dir</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">Entry</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">Mark</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">Size</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">SL</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">TP</TableHead>
                  <TableHead className="text-right text-xs font-medium text-text-secondary">uPnL</TableHead>
                  <TableHead className="hidden text-right text-xs font-medium text-text-tertiary lg:table-cell">Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((pos) => {
                  const liveUpnl = calculatePositionUpnl(pos, prices.get(pos.symbol));
                  const upnlValue = pricesReady && liveUpnl !== undefined ? liveUpnl : undefined;
                  const displayValue = upnlValue ?? pos.unrealizedPnl;

                  return (
                    <TableRow key={pos.id} className="h-10 hover:bg-void-muted">
                      <TableCell className="font-mono text-sm font-semibold text-text-primary">
                        {pos.symbol}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-none px-1.5 py-0.5 text-xs font-medium",
                            pos.direction === "long"
                              ? "bg-terminal-amber-muted text-data-profit"
                              : "bg-terminal-amber-muted text-data-loss"
                          )}
                        >
                          {pos.direction.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text-secondary">
                        {pos.entryPrice.toPrecision(6)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text-secondary">
                        {pricesReady && prices.get(pos.symbol) !== undefined
                          ? prices.get(pos.symbol)!.toPrecision(6)
                          : SPINNER_FRAMES[0]}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text-secondary">
                        ${pos.positionSize.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text-tertiary">
                        {pos.stopLoss ? pos.stopLoss.toPrecision(6) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-text-tertiary">
                        {pos.takeProfit ? pos.takeProfit.toPrecision(6) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-sm font-semibold tabular-nums",
                          upnlValue === undefined && "text-text-tertiary",
                          upnlValue !== undefined && displayValue > 0 && "text-data-profit",
                          upnlValue !== undefined && displayValue < 0 && "text-data-loss",
                          upnlValue !== undefined && displayValue === 0 && "text-text-secondary"
                        )}
                      >
                        {upnlValue === undefined
                          ? SPINNER_FRAMES[0]
                          : `${displayValue >= 0 ? "+" : ""}${displayValue.toFixed(2)}`}
                      </TableCell>
                      <TableCell className="hidden text-right font-mono text-xs tabular-nums text-text-tertiary lg:table-cell" title={`Local: ${formatTimestamp(pos.openedAt).local}`}>
                        {formatTimestamp(pos.openedAt).utc}
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
