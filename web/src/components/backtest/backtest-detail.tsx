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
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold ${color ?? "text-primary"}`}>
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
      ? "text-[var(--bullish-strong)]"
      : "text-[var(--bearish-strong)]";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">
            Backtest #{run.id} — {run.strategyArchetype}
          </h1>
          <p className="text-sm text-muted">
            {run.symbol} {run.timeframe} &middot;{" "}
            {new Date(run.startDate).toLocaleDateString()} –{" "}
            {new Date(run.endDate).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            run.status === "completed"
              ? "border-[var(--bullish-strong)]/20 bg-[var(--bullish-strong)]/10 text-[var(--bullish-strong)]"
              : run.status === "failed"
                ? "border-[var(--bearish-strong)]/20 bg-[var(--bearish-strong)]/10 text-[var(--bearish-strong)]"
                : "border-blue-500/20 bg-blue-500/10 text-blue-400"
          }`}
        >
          {run.status}
        </span>
      </div>

      {run.status === "failed" && run.errorMessage && (
        <div className="rounded-lg border border-[var(--bearish-strong)]/20 bg-[var(--bearish-strong)]/5 p-3">
          <p className="text-xs text-[var(--bearish-strong)]">
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
          color="text-[var(--bearish-strong)]"
        />
        <StatCard
          label="Sharpe Ratio"
          value={run.sharpeRatio != null ? run.sharpeRatio.toFixed(2) : "-"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-default)]">
        <button
          onClick={() => setTab("overview")}
          className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors-fast ${
            tab === "overview"
              ? "border-b-2 border-[var(--accent)] text-primary"
              : "text-muted hover:text-secondary"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("trades")}
          className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors-fast ${
            tab === "trades"
              ? "border-b-2 border-[var(--accent)] text-primary"
              : "text-muted hover:text-secondary"
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
            <div className="flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
              <p className="text-sm text-muted">
                {run.status === "completed"
                  ? "No equity curve data"
                  : "Backtest in progress..."}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "trades" && (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
          {trades.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted">No trades recorded</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-left text-xs text-muted">
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
                    className="border-b border-[var(--border-subtle)]"
                  >
                    <td className="px-3 py-2 font-mono text-muted">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.direction === "long"
                            ? "bg-[var(--bullish-strong)]/10 text-[var(--bullish-strong)]"
                            : "bg-[var(--bearish-strong)]/10 text-[var(--bearish-strong)]"
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
                          ? "text-[var(--bullish-strong)]"
                          : "text-[var(--bearish-strong)]"
                      }`}
                    >
                      {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted">
                      ${t.fees.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {t.exitReason.replace("_", " ")}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {formatDuration(t.durationMinutes)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
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
