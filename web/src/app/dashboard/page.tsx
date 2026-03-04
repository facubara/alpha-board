import Link from "next/link";
import { DottedLoader, PageHeader } from "@/components/terminal";
import { getAgentLeaderboard } from "@/lib/queries/agents";
import { getRecentTrades } from "@/lib/queries/trades";
import type { TradeNotification } from "@/lib/types";

function formatTimeAgo(ts: string): string {
  const now = Date.now();
  const d = new Date(ts).getTime();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default async function DashboardPage() {
  const [agents, trades] = await Promise.all([
    getAgentLeaderboard().catch(() => []),
    getRecentTrades(10).catch(() => [] as TradeNotification[]),
  ]);

  const activeAgents = agents?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Terminal" badge="v1" subtitle=">_ TERMINAL: INITIALIZED" />

      {/* Fleet Summary Cards */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-none border border-void-border bg-void-surface px-4 py-4">
          <div className="text-xs uppercase tracking-widest text-text-tertiary font-mono">Active Agents</div>
          <div className="mt-2 text-3xl font-mono font-semibold text-text-primary">{activeAgents}</div>
        </div>
        <div className="rounded-none border border-void-border bg-void-surface px-4 py-4">
          <div className="text-xs uppercase tracking-widest text-text-tertiary font-mono">24H Fleet PnL</div>
          <div className="mt-2 text-3xl font-mono font-semibold text-data-profit">—</div>
          <div className="text-xs text-text-tertiary mt-1">Aggregated on next cycle</div>
        </div>
        <div className="rounded-none border border-void-border bg-void-surface px-4 py-4">
          <div className="text-xs uppercase tracking-widest text-text-tertiary font-mono">System Status</div>
          <div className="mt-2 flex items-center gap-2">
            <DottedLoader />
            <span className="text-lg font-mono font-semibold text-data-profit">OPERATIONAL</span>
          </div>
        </div>
      </div>

      {/* User Deployments */}
      <div className="rounded-none border border-dashed border-void-border bg-void-surface px-6 py-8 text-center">
        <p className="font-mono text-sm text-text-tertiary">NO AGENTS DEPLOYED. SYSTEM IDLE.</p>
        <Link
          href="/agents/marketplace"
          className="mt-4 inline-block font-mono text-sm text-terminal-amber hover:underline"
        >
          [ BROWSE AGENT MARKETPLACE ]
        </Link>
      </div>

      {/* Live Execution Feed */}
      <div>
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-3">Live Execution Feed</h2>
        {trades.length > 0 ? (
          <div className="overflow-x-auto rounded-none border border-void-border">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-void-border bg-void-surface text-text-tertiary">
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Direction</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2 text-right">PnL</th>
                  <th className="px-3 py-2 text-right">Type</th>
                  <th className="px-3 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade: TradeNotification) => {
                  const pnlColor = trade.pnl == null ? "text-text-tertiary" : trade.pnl >= 0 ? "text-data-profit" : "text-data-loss";
                  return (
                    <tr key={trade.id} className="border-b border-void-border last:border-b-0 hover:bg-void-muted">
                      <td className="px-3 py-2 text-text-primary">{trade.symbol}</td>
                      <td className={`px-3 py-2 ${trade.direction === "long" ? "text-data-profit" : "text-data-loss"}`}>
                        {trade.direction.toUpperCase()}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{trade.agentName}</td>
                      <td className={`px-3 py-2 text-right ${pnlColor}`}>
                        {trade.pnl != null ? `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary">{trade.type === "trade_opened" ? "OPEN" : "CLOSED"}</td>
                      <td className="px-3 py-2 text-right text-text-tertiary">{trade.timestamp ? formatTimeAgo(trade.timestamp) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-none border border-void-border bg-void-surface px-4 py-6 text-center text-sm text-text-tertiary font-mono">
            NO RECENT EXECUTIONS
          </div>
        )}
      </div>
    </div>
  );
}
