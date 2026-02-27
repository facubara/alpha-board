"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BacktestRun } from "@/lib/types";
import { useAuth } from "@/components/auth/auth-provider";
import { cancelBacktest } from "@/app/backtest/actions";

interface BacktestListProps {
  runs: BacktestRun[];
}

const STATUS_STYLES: Record<string, string> = {
  pending:
    "bg-[var(--accent-yellow-subtle)] text-[var(--accent-yellow)] border-[var(--accent-yellow)]/20",
  running:
    "bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)] border-[var(--accent-blue)]/20",
  completed:
    "bg-[var(--bullish-strong)]/10 text-[var(--bullish-strong)] border-[var(--bullish-strong)]/20",
  failed:
    "bg-[var(--bearish-strong)]/10 text-[var(--bearish-strong)] border-[var(--bearish-strong)]/20",
  cancelled:
    "bg-[var(--accent-zinc-subtle)] text-muted border-[var(--text-muted)]/20",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {status}
    </span>
  );
}

function formatPnl(pnl: number | null): string {
  if (pnl == null) return "-";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}$${pnl.toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function BacktestList({ runs }: BacktestListProps) {
  const router = useRouter();
  const { requireAuth } = useAuth();
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  async function handleCancel(runId: number) {
    requireAuth(async () => {
      setCancellingId(runId);
      await cancelBacktest(runId);
      setCancellingId(null);
      router.refresh();
    });
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
        <p className="text-sm text-muted">
          No backtests yet. Launch one above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-default)] text-left text-xs text-muted">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Strategy</th>
            <th className="px-3 py-2 font-medium">Symbol</th>
            <th className="px-3 py-2 font-medium">TF</th>
            <th className="px-3 py-2 font-medium">Period</th>
            <th className="px-3 py-2 font-medium text-right">PnL</th>
            <th className="px-3 py-2 font-medium text-right">Trades</th>
            <th className="px-3 py-2 font-medium text-right">Win%</th>
            <th className="px-3 py-2 font-medium text-right">Drawdown</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const winRate =
              run.totalTrades > 0
                ? ((run.winningTrades / run.totalTrades) * 100).toFixed(0)
                : "-";
            const canCancel = run.status === "pending" || run.status === "running";

            return (
              <tr
                key={run.id}
                className="border-b border-[var(--border-subtle)] transition-colors-fast hover:bg-[var(--bg-elevated)]"
              >
                <td className="px-3 py-2 font-mono text-muted">
                  <Link
                    href={`/backtest/${run.id}`}
                    className="hover:text-primary"
                  >
                    {run.id}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/backtest/${run.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {run.strategyArchetype}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono">{run.symbol}</td>
                <td className="px-3 py-2">{run.timeframe}</td>
                <td className="px-3 py-2 text-muted">
                  {formatDate(run.startDate)} – {formatDate(run.endDate)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${
                    run.totalPnl != null && run.totalPnl >= 0
                      ? "text-[var(--bullish-strong)]"
                      : "text-[var(--bearish-strong)]"
                  }`}
                >
                  {formatPnl(run.totalPnl)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {run.totalTrades}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {winRate}%
                </td>
                <td className="px-3 py-2 text-right font-mono text-muted">
                  {run.maxDrawdownPct != null
                    ? `${run.maxDrawdownPct.toFixed(1)}%`
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-3 py-2">
                  {canCancel && (
                    <button
                      onClick={() => handleCancel(run.id)}
                      disabled={cancellingId === run.id}
                      className="rounded p-1 text-muted transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-[var(--bearish-strong)] disabled:opacity-50"
                      title="Cancel backtest"
                    >
                      {cancellingId === run.id ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
