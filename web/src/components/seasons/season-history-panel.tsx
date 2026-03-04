"use client";

import { useEffect, useState } from "react";
import type {
  Timeframe,
  TimeframeSeasonHistory,
  SeasonHistoryEntry,
} from "@/lib/types";

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}$${pnl.toFixed(2)}`;
}

interface Props {
  timeframe: Timeframe;
}

export function SeasonHistoryPanel({ timeframe }: Props) {
  const [data, setData] = useState<TimeframeSeasonHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const workerUrl =
      process.env.NEXT_PUBLIC_WORKER_URL || "https://alpha-worker.fly.dev";

    fetch(`${workerUrl}/seasons/${timeframe}/history`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: TimeframeSeasonHistory) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [timeframe]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-[var(--bg-elevated)]" />
          <div className="h-32 rounded bg-[var(--bg-elevated)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-sm text-bearish">
        Failed to load history: {error}
      </div>
    );
  }

  if (!data || data.history.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-sm text-muted">
        No completed seasons yet for {timeframe.toUpperCase()}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.history.map((entry: SeasonHistoryEntry) => (
        <div
          key={entry.season}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-medium text-primary">
              Season {entry.season}
            </h4>
            <span className="text-xs text-muted">
              {new Date(entry.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-left text-muted">
                  <th className="pb-2 pr-4 font-medium">Agent</th>
                  <th className="pb-2 pr-4 text-right font-medium">Equity</th>
                  <th className="pb-2 pr-4 text-right font-medium">PnL</th>
                  <th className="pb-2 pr-4 text-right font-medium">Trades</th>
                  <th className="pb-2 pr-4 text-right font-medium">Win%</th>
                  <th className="pb-2 text-right font-medium">Peak</th>
                </tr>
              </thead>
              <tbody>
                {entry.agents.map((agent) => (
                  <tr
                    key={agent.agentId}
                    className="border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <td className="py-1.5 pr-4 text-secondary">
                      {agent.displayName}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-primary">
                      ${agent.totalEquity.toFixed(2)}
                    </td>
                    <td
                      className={`py-1.5 pr-4 text-right font-mono ${
                        agent.totalRealizedPnl >= 0
                          ? "text-bullish"
                          : "text-bearish"
                      }`}
                    >
                      {formatPnl(agent.totalRealizedPnl)}
                    </td>
                    <td className="py-1.5 pr-4 text-right text-secondary">
                      {agent.tradeCount}
                    </td>
                    <td className="py-1.5 pr-4 text-right text-secondary">
                      {agent.winRate.toFixed(1)}%
                    </td>
                    <td className="py-1.5 text-right font-mono text-muted">
                      ${agent.peakEquity.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
