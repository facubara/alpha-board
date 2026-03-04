"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BacktestRun } from "@/lib/types";
import { useAuth } from "@/components/auth/auth-provider";
import { cancelBacktest } from "@/app/lab/backtest/actions";

interface BacktestListProps {
  runs: BacktestRun[];
}

const STATUS_STYLES: Record<string, string> = {
  pending:
    "bg-void-muted text-terminal-amber border-terminal-amber/20",
  running:
    "bg-void-muted text-text-secondary border-void-border",
  completed:
    "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20",
  failed:
    "bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20",
  cancelled:
    "bg-void-muted text-text-tertiary border-text-tertiary/20",
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
      <div className="rounded-none border border-void-border bg-void-surface p-8 text-center">
        <p className="text-sm text-text-tertiary">
          No backtests yet. Launch one above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-none border border-void-border bg-void-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-void-border text-left text-xs text-text-tertiary">
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
                className="border-b border-void-border transition-colors-fast hover:bg-void-muted"
              >
                <td className="px-3 py-2 font-mono text-text-tertiary">
                  <Link
                    href={`/lab/backtest/${run.id}`}
                    className="hover:text-text-primary"
                  >
                    {run.id}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/lab/backtest/${run.id}`}
                    className="font-medium text-text-primary hover:underline"
                  >
                    {run.strategyArchetype}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono">{run.symbol}</td>
                <td className="px-3 py-2">{run.timeframe}</td>
                <td className="px-3 py-2 text-text-tertiary">
                  {formatDate(run.startDate)} – {formatDate(run.endDate)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${
                    run.totalPnl != null && run.totalPnl >= 0
                      ? "text-[#10B981]"
                      : "text-[#F43F5E]"
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
                <td className="px-3 py-2 text-right font-mono text-text-tertiary">
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
                      className="rounded-none p-1 text-text-tertiary transition-colors-fast hover:bg-void-muted hover:text-[#F43F5E] disabled:opacity-50"
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
