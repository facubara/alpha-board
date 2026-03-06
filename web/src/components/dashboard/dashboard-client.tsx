"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { DottedAvatar, DottedLoader } from "@/components/terminal";
import { useFetch } from "@/hooks/use-fetch";
import {
  AXIS_TICK_STYLE,
  GRID_PROPS,
  TOOLTIP_STYLE,
  CHART_COLORS,
  formatUsd,
} from "@/lib/chart-theme";
import type {
  AgentLeaderboardRow,
  ExchangeSettings,
  TradeNotification,
} from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

function formatExactTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Mock allocation data per agent
const MOCK_ALLOCATIONS: Record<number, string> = {
  1: "$1,200",
  2: "$800",
  3: "$950",
  4: "$600",
  5: "$500",
  6: "$1,500",
  7: "$700",
  8: "$780",
  9: "$850",
  10: "$400",
};

// Generate mock 24h PnL chart data (hourly ticks)
function generateMockChartData(trades: TradeNotification[]) {
  const points: { time: string; pnl: number }[] = [];
  let cumPnl = 0;
  for (let i = 23; i >= 0; i--) {
    const h = new Date();
    h.setHours(h.getHours() - i, 0, 0, 0);
    const label = h.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // Simulate PnL accumulation
    const delta =
      i > 0
        ? (Math.sin(i * 0.8) * 30 + Math.random() * 20 - 5)
        : 0;
    cumPnl += delta;
    points.push({ time: label, pnl: Math.round(cumPnl * 100) / 100 });
  }
  return points;
}

interface DashboardClientProps {
  activeAgents: AgentLeaderboardRow[];
  totalAgents: number;
  realizedPnl24h: number;
  trades: TradeNotification[];
}

export function DashboardClient({
  activeAgents,
  totalAgents,
  realizedPnl24h,
  trades,
}: DashboardClientProps) {
  const fetchUrl = WORKER_URL ? `${WORKER_URL}/exchange/settings` : null;
  const { data: exchangeSettings } = useFetch<ExchangeSettings>(fetchUrl);

  const isConnected =
    exchangeSettings?.configured && exchangeSettings?.enabled;

  const chartData = useMemo(() => generateMockChartData(trades), [trades]);
  const finalPnl = chartData[chartData.length - 1]?.pnl ?? 0;
  const chartColor = finalPnl >= 0 ? CHART_COLORS.bullish : CHART_COLORS.bearish;

  return (
    <div className="space-y-4">
      {/* Zone A: System Status & PnL */}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Exchange Uplink */}
        <div className="rounded-none border border-void-border bg-void-surface px-5 py-4">
          <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
            Exchange Uplink
          </div>
          <div className="mt-3">
            {isConnected ? (
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-data-profit opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-data-profit" />
                </span>
                <div>
                  <div className="font-mono text-lg font-medium text-data-profit">
                    BINANCE: SECURE
                  </div>
                  <div className="font-mono text-xs text-text-tertiary">
                    Mode:{" "}
                    {exchangeSettings?.tradingMode?.toUpperCase() ?? "FUTURES"}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 font-mono text-lg font-medium text-terminal-amber">
                  <span>[ ! ]</span>
                  <span>BINANCE API: OFFLINE</span>
                </div>
                <Link
                  href="/settings"
                  className="mt-2 inline-block font-mono text-xs text-terminal-amber transition-colors-fast hover:text-text-primary"
                >
                  [ CONFIGURE CONNECTION ]
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Active Deployments + Halt All */}
        <div className="rounded-none border border-void-border bg-void-surface px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
              Active Deployments
            </div>
            {activeAgents.length > 0 && (
              <button className="font-mono text-xs text-data-loss border border-data-loss px-2 py-0.5 transition-colors hover:bg-data-loss hover:text-void">
                [ HALT ALL ]
              </button>
            )}
          </div>
          <div className="mt-2 font-mono text-4xl font-medium text-text-primary">
            {activeAgents.length}
          </div>
          <div className="mt-1 font-mono text-xs text-text-tertiary">
            FLEET CAPACITY: {activeAgents.length}/{totalAgents}
          </div>
        </div>

        {/* Card 3: 24H Realized PnL */}
        <div className="rounded-none border border-void-border bg-void-surface px-5 py-4">
          <div className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
            24H Realized PnL
          </div>
          <div
            className={`mt-2 font-mono text-4xl font-medium ${
              realizedPnl24h >= 0 ? "text-data-profit" : "text-data-loss"
            }`}
          >
            {realizedPnl24h >= 0 ? "+" : ""}${realizedPnl24h.toFixed(2)}
          </div>
          <div className="mt-1 font-mono text-xs text-text-tertiary">
            From closed trades (last 24h)
          </div>
        </div>
      </div>

      {/* Aggregate Fleet PnL Chart */}
      <div className="w-full rounded-none border border-void-border bg-void-surface p-4">
        <span className="font-mono text-xs text-text-tertiary uppercase tracking-widest">
          {">_ AGGREGATE FLEET PNL (24H)"}
        </span>
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
            >
              <defs>
                <linearGradient id="fleetPnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS.amber}
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS.amber}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis
                dataKey="time"
                tick={{ ...AXIS_TICK_STYLE, fill: "#52525B" }}
                axisLine={false}
                tickLine={false}
                minTickGap={50}
                tickMargin={6}
                height={24}
              />
              <YAxis
                tickFormatter={formatUsd}
                tick={{ ...AXIS_TICK_STYLE, fill: "#52525B" }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickMargin={4}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE.contentStyle}
                cursor={TOOLTIP_STYLE.cursor}
                itemStyle={TOOLTIP_STYLE.itemStyle}
                labelStyle={TOOLTIP_STYLE.labelStyle}
                formatter={(value) => [
                  formatUsd(Number(value)),
                  "Fleet PnL",
                ]}
              />
              <ReferenceLine y={0} stroke="#27272A" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={CHART_COLORS.amber}
                strokeWidth={1.5}
                fill="url(#fleetPnlGrad)"
                dot={false}
                activeDot={{ r: 3, fill: CHART_COLORS.amber }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Split-pane: Agent Roster (left) + Execution Feed (right) */}
      {activeAgents.length === 0 ? (
        <div className="rounded-none border border-dashed border-void-border bg-void-surface px-6 py-12 text-center">
          <p className="font-mono text-sm text-text-tertiary">
            SYSTEM IDLE. NO AGENTS ASSIGNED.
          </p>
          <Link
            href="/agents"
            className="mt-4 inline-block rounded-none border border-terminal-amber bg-terminal-amber-muted px-4 py-2 font-mono text-sm text-terminal-amber transition-colors-fast hover:bg-terminal-amber hover:text-void"
          >
            [ BROWSE AGENT MARKETPLACE ]
          </Link>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Pane: Agent Roster */}
          <div className="flex flex-col lg:col-span-7">
            {/* Roster header */}
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
                {">> ACTIVE AGENT ROSTER"}
              </span>
              <Link
                href="/agents"
                className="font-mono text-xs border border-terminal-amber text-terminal-amber px-3 py-1 transition-colors hover:bg-terminal-amber hover:text-void"
              >
                [ + DEPLOY NEW AGENT ]
              </Link>
            </div>
            <div className="overflow-hidden rounded-none border border-void-border max-h-[540px] overflow-y-auto terminal-scroll">
              <table className="table-fixed w-full text-sm font-mono">
                <thead className="sticky top-0 z-10 bg-void-surface">
                  <tr className="border-b border-void-border text-text-tertiary text-xs">
                    <th className="w-[28%] py-2 pl-4 text-left">Agent</th>
                    <th className="w-[8%] py-2 text-center">TF</th>
                    <th className="w-[14%] py-2 text-left">Status</th>
                    <th className="w-[12%] py-2 text-right">Alloc.</th>
                    <th className="w-[8%] py-2 text-right">Trades</th>
                    <th className="w-[8%] py-2 text-right">WR</th>
                    <th className="w-[12%] py-2 text-right">PnL</th>
                    <th className="w-[10%] py-2 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                    {activeAgents.map((agent) => (
                      <tr
                        key={agent.id}
                        className="border-b border-void-border last:border-b-0 cursor-pointer hover:bg-void-muted transition-colors"
                        onClick={() => window.location.href = `/agents/${agent.uuid || agent.id}`}
                      >
                        <td className="py-2 pl-4 text-left">
                          <div className="flex items-center gap-2">
                            <DottedAvatar
                              agentId={String(agent.id)}
                              gridSize={4}
                              status="executing"
                            />
                            <div className="min-w-0">
                              <div className="text-text-primary truncate">
                                {agent.displayName}
                              </div>
                              <div className="text-[10px] text-text-tertiary truncate">
                                {agent.strategyArchetype} /{" "}
                                {agent.engine.toUpperCase()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 text-center text-text-secondary uppercase">
                          {agent.timeframe}
                        </td>
                        <td className="py-2 text-left">
                          <span className="flex items-center gap-1.5">
                            <DottedLoader color="bg-data-profit" />
                            <span className="text-data-profit text-[10px]">
                              ACTIVE
                            </span>
                          </span>
                        </td>
                        <td className="py-2 text-right text-text-secondary">
                          {MOCK_ALLOCATIONS[agent.id] ?? "$500"}
                        </td>
                        <td className="py-2 text-right text-text-primary">
                          {agent.tradeCount}
                        </td>
                        <td className="py-2 text-right text-text-secondary">
                          {(agent.winRate * 100).toFixed(0)}%
                        </td>
                        <td
                          className={`py-2 text-right ${
                            agent.totalPnl >= 0
                              ? "text-data-profit"
                              : "text-data-loss"
                          }`}
                        >
                          {agent.totalPnl >= 0 ? "+" : ""}$
                          {agent.totalPnl.toFixed(0)}
                        </td>
                        <td className="py-2 text-right pr-4 whitespace-nowrap">
                          <button
                            className="text-text-secondary hover:text-terminal-amber transition-colors px-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            [ || ]
                          </button>
                          <button
                            className="text-text-secondary hover:text-data-loss transition-colors px-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            [ ✕ ]
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>

          {/* Right Pane: Execution Feed */}
          <div className="flex flex-col lg:col-span-5">
            <div className="mb-3 font-mono text-xs uppercase tracking-widest text-text-tertiary">
              {">> RECENT EXECUTIONS"}
            </div>
            {trades.length > 0 ? (
              <div className="overflow-hidden rounded-none border border-void-border max-h-[540px] overflow-y-auto terminal-scroll">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="sticky top-0 z-10 bg-void-surface">
                    <tr className="border-b border-void-border text-text-tertiary">
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Symbol</th>
                      <th className="px-2 py-2">Side</th>
                      <th className="px-2 py-2 text-right">Price</th>
                      <th className="px-2 py-2 text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                      {trades.map((trade) => {
                        const pnlColor =
                          trade.pnl == null
                            ? "text-text-tertiary"
                            : trade.pnl >= 0
                              ? "text-data-profit"
                              : "text-data-loss";
                        return (
                          <tr
                            key={trade.id}
                            className="border-b border-void-border last:border-b-0 hover:bg-void-muted transition-colors"
                          >
                            <td className="px-2 py-2 text-text-tertiary">
                              {trade.timestamp
                                ? formatExactTime(trade.timestamp)
                                : "\u2014"}
                            </td>
                            <td className="px-2 py-2 text-text-primary">
                              {trade.symbol}
                            </td>
                            <td
                              className={`px-2 py-2 ${
                                trade.direction === "long"
                                  ? "text-data-profit"
                                  : "text-data-loss"
                              }`}
                            >
                              {trade.direction.toUpperCase()}
                            </td>
                            <td className="px-2 py-2 text-right text-text-primary">
                              $
                              {trade.entryPrice.toFixed(
                                trade.entryPrice < 1 ? 6 : 2
                              )}
                            </td>
                            <td
                              className={`px-2 py-2 text-right ${pnlColor}`}
                            >
                              {trade.pnl != null
                                ? `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`
                                : "\u2014"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-none border border-void-border bg-void-surface px-4 py-8 text-center font-mono text-sm text-text-tertiary">
                NO RECENT EXECUTIONS
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
