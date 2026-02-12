import Link from "next/link";
import type { BacktestRun } from "@/lib/types";

interface BacktestListProps {
  runs: BacktestRun[];
}

const STATUS_STYLES: Record<string, string> = {
  pending:
    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  running:
    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  completed:
    "bg-[var(--bullish-strong)]/10 text-[var(--bullish-strong)] border-[var(--bullish-strong)]/20",
  failed:
    "bg-[var(--bearish-strong)]/10 text-[var(--bearish-strong)] border-[var(--bearish-strong)]/20",
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
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const winRate =
              run.totalTrades > 0
                ? ((run.winningTrades / run.totalTrades) * 100).toFixed(0)
                : "-";

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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
