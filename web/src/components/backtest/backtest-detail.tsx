"use client";

import { useState } from "react";
import type { BacktestRun, BacktestTrade } from "@/lib/types";
import { BacktestEquityChart } from "./backtest-equity-chart";

interface BacktestDetailProps {
  run: BacktestRun;
  trades: BacktestTrade[];
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-none border border-void-border bg-void-surface p-3">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold ${color ?? "text-text-primary"}`}>
        {value}
      </p>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

export function BacktestDetail({ run, trades }: BacktestDetailProps) {
  const [tab, setTab] = useState<"overview" | "trades">("overview");

  const winRate =
    run.totalTrades > 0
      ? ((run.winningTrades / run.totalTrades) * 100).toFixed(1)
      : "0";

  const pnlColor =
    run.totalPnl != null && run.totalPnl >= 0
      ? "text-[#10B981]"
      : "text-[#F43F5E]";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            Backtest #{run.id} — {run.strategyArchetype}
          </h1>
          <p className="text-sm text-text-tertiary">
            {run.symbol} {run.timeframe} &middot;{" "}
            {new Date(run.startDate).toLocaleDateString()} –{" "}
            {new Date(run.endDate).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            run.status === "completed"
              ? "border-[#10B981]/20 bg-[#10B981]/10 text-[#10B981]"
              : run.status === "failed"
                ? "border-[#F43F5E]/20 bg-[#F43F5E]/10 text-[#F43F5E]"
                : "border-void-border bg-void-muted text-text-secondary"
          }`}
        >
          {run.status}
        </span>
      </div>

      {run.status === "failed" && run.errorMessage && (
        <div className="rounded-none border border-[#F43F5E]/20 bg-[#F43F5E]/5 p-3">
          <p className="text-xs text-[#F43F5E]">
            {run.errorMessage}
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard
          label="Total PnL"
          value={
            run.totalPnl != null
              ? `${run.totalPnl >= 0 ? "+" : ""}$${run.totalPnl.toFixed(2)}`
              : "-"
          }
          color={pnlColor}
        />
        <StatCard
          label="Final Equity"
          value={
            run.finalEquity != null
              ? `$${run.finalEquity.toLocaleString()}`
              : "-"
          }
        />
        <StatCard label="Trades" value={String(run.totalTrades)} />
        <StatCard label="Win Rate" value={`${winRate}%`} />
        <StatCard
          label="Max Drawdown"
          value={
            run.maxDrawdownPct != null
              ? `${run.maxDrawdownPct.toFixed(2)}%`
              : "-"
          }
          color="text-[#F43F5E]"
        />
        <StatCard
          label="Sharpe Ratio"
          value={run.sharpeRatio != null ? run.sharpeRatio.toFixed(2) : "-"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-void-border">
        <button
          onClick={() => setTab("overview")}
          className={`rounded-t-none px-4 py-2 text-sm font-medium transition-colors-fast ${
            tab === "overview"
              ? "border-b-2 border-text-primary text-text-primary"
              : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("trades")}
          className={`rounded-t-none px-4 py-2 text-sm font-medium transition-colors-fast ${
            tab === "trades"
              ? "border-b-2 border-text-primary text-text-primary"
              : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Trades ({trades.length})
        </button>
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div>
          {run.equityCurve && run.equityCurve.length > 0 ? (
            <BacktestEquityChart
              equityCurve={run.equityCurve}
              initialBalance={run.initialBalance}
            />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-none border border-void-border bg-void-surface">
              <p className="text-sm text-text-tertiary">
                {run.status === "completed"
                  ? "No equity curve data"
                  : "Backtest in progress..."}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "trades" && (
        <div className="overflow-x-auto rounded-none border border-void-border bg-void-surface">
          {trades.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-text-tertiary">No trades recorded</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-void-border text-left text-xs text-text-tertiary">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Direction</th>
                  <th className="px-3 py-2 font-medium text-right">
                    Entry Price
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    Exit Price
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Size</th>
                  <th className="px-3 py-2 font-medium text-right">PnL</th>
                  <th className="px-3 py-2 font-medium text-right">Fees</th>
                  <th className="px-3 py-2 font-medium">Exit Reason</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                  <th className="px-3 py-2 font-medium">Entry</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr
                    key={t.id}
                    className="border-b border-void-border"
                  >
                    <td className="px-3 py-2 font-mono text-text-tertiary">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.direction === "long"
                            ? "bg-[#10B981]/10 text-[#10B981]"
                            : "bg-[#F43F5E]/10 text-[#F43F5E]"
                        }`}
                      >
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.entryPrice < 1
                        ? t.entryPrice.toFixed(6)
                        : t.entryPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.exitPrice < 1
                        ? t.exitPrice.toFixed(6)
                        : t.exitPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      ${t.positionSize.toFixed(0)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono ${
                        t.pnl >= 0
                          ? "text-[#10B981]"
                          : "text-[#F43F5E]"
                      }`}
                    >
                      {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-text-tertiary">
                      ${t.fees.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-text-tertiary">
                      {t.exitReason.replace("_", " ")}
                    </td>
                    <td className="px-3 py-2 text-xs text-text-tertiary">
                      {formatDuration(t.durationMinutes)}
                    </td>
                    <td className="px-3 py-2 text-xs text-text-tertiary">
                      {new Date(t.entryAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
