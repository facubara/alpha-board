import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChartContainer } from "@/components/charts/chart-container";
import { getSymbolAgentActivity } from "@/lib/queries/agents";

export const dynamic = "force-dynamic";

const SYMBOL_RE = /^[A-Z0-9]{2,20}$/;

interface SymbolPageProps {
  params: Promise<{ symbol: string }>;
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toFixed(2)}`;
  if (value >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function SymbolPage({ params }: SymbolPageProps) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  if (!SYMBOL_RE.test(upperSymbol)) {
    notFound();
  }

  const activity = await getSymbolAgentActivity(upperSymbol);
  const { summary, positions, trades } = activity;
  const hasActivity = positions.length > 0 || trades.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-mono text-2xl font-bold tracking-tight text-text-primary">
          {upperSymbol}
        </h1>
        <a
          href={`https://www.binance.com/en/trade/${upperSymbol.replace("USDT", "_USDT")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#F0B90B] transition-transform hover:scale-110"
          title="Trade on Binance"
        >
          <svg className="h-4 w-4" viewBox="0 0 32 32" fill="currentColor">
            <path d="M16 4l4 4-4 4-4-4zm8 8l4 4-4 4-4-4zm-16 0l4 4-4 4-4-4zm8 8l4 4-4 4-4-4z" />
          </svg>
        </a>
      </div>

      <ChartContainer symbol={upperSymbol} height={600} />

      {/* Indicator legend */}
      <div className="flex flex-wrap gap-4 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-none bg-[#3B82F6]" />
          EMA 20
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-none bg-[#F59E0B]" />
          EMA 50
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-none bg-[#8B5CF6]" />
          EMA 200
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-none"
            style={{
              backgroundImage: "repeating-linear-gradient(to right, #6B6B6B 0, #6B6B6B 3px, transparent 3px, transparent 6px)",
            }}
          />
          Bollinger Bands
        </span>
      </div>

      {/* Agent Activity */}
      <div className="rounded-none border border-void-border bg-void-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Agent Activity</h2>

        {!hasActivity ? (
          <p className="text-xs text-text-tertiary">No agent activity for this symbol</p>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-text-secondary">
              {summary.agentsWithPositions > 0 && (
                <span>
                  <span className="font-medium text-text-primary">{summary.agentsWithPositions}</span>{" "}
                  agent{summary.agentsWithPositions !== 1 ? "s" : ""} holding positions
                </span>
              )}
              {summary.agentsWithPositions > 0 && summary.agentsThatTraded > 0 && (
                <span className="text-text-tertiary">·</span>
              )}
              {summary.agentsThatTraded > 0 && (
                <span>
                  <span className="font-medium text-text-primary">{summary.agentsThatTraded}</span>{" "}
                  agent{summary.agentsThatTraded !== 1 ? "s" : ""} traded
                </span>
              )}
              {summary.totalTrades > 0 && (
                <>
                  <span className="text-text-tertiary">·</span>
                  <span
                    className={cn(
                      "font-mono font-medium tabular-nums",
                      summary.totalPnl >= 0 ? "text-data-profit" : "text-data-loss"
                    )}
                  >
                    {formatPnl(summary.totalPnl)}
                  </span>
                  <span>total PnL</span>
                  <span className="text-text-tertiary">·</span>
                  <span>
                    <span className="font-medium text-text-primary">{(summary.winRate * 100).toFixed(0)}%</span> win rate
                  </span>
                </>
              )}
            </div>

            {/* Open Positions */}
            {positions.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
                  Open Positions ({positions.length})
                </h3>
                <div className="space-y-1">
                  {positions.map((pos, i) => (
                    <div
                      key={`${pos.agentId}-${i}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs"
                    >
                      <Link
                        href={`/agents/${pos.agentId}`}
                        className="min-w-[140px] truncate font-medium text-text-primary hover:underline"
                      >
                        {pos.agentDisplayName}
                      </Link>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs uppercase",
                          pos.direction === "long"
                            ? "bg-terminal-amber-muted text-[#10B981] hover:bg-terminal-amber-muted"
                            : "bg-terminal-amber-muted text-[#F43F5E] hover:bg-terminal-amber-muted"
                        )}
                      >
                        {pos.direction}
                      </Badge>
                      <span className="font-mono tabular-nums text-text-secondary">
                        {formatPrice(pos.entryPrice)}
                      </span>
                      <span className="font-mono tabular-nums text-text-secondary">
                        {pos.positionSize.toFixed(4)}
                      </span>
                      <span
                        className={cn(
                          "font-mono font-medium tabular-nums",
                          pos.unrealizedPnl >= 0 ? "text-data-profit" : "text-data-loss"
                        )}
                      >
                        {formatPnl(pos.unrealizedPnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Trades */}
            {trades.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
                  Recent Trades ({trades.length})
                </h3>
                <div className="space-y-1">
                  {trades.map((trade, i) => (
                    <div
                      key={`${trade.agentId}-${i}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs"
                    >
                      <Link
                        href={`/agents/${trade.agentId}`}
                        className="min-w-[140px] truncate font-medium text-text-primary hover:underline"
                      >
                        {trade.agentDisplayName}
                      </Link>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs uppercase",
                          trade.direction === "long"
                            ? "bg-terminal-amber-muted text-[#10B981] hover:bg-terminal-amber-muted"
                            : "bg-terminal-amber-muted text-[#F43F5E] hover:bg-terminal-amber-muted"
                        )}
                      >
                        {trade.direction}
                      </Badge>
                      <span
                        className={cn(
                          "font-mono font-medium tabular-nums",
                          trade.pnl >= 0 ? "text-data-profit" : "text-data-loss"
                        )}
                      >
                        {formatPnl(trade.pnl)}
                      </span>
                      <span className="text-text-tertiary">
                        {formatDate(trade.closedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
