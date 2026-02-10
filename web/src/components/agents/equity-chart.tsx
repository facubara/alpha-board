"use client";

/**
 * EquityChart Component
 *
 * Simple SVG line chart showing equity curve derived from trade history.
 * No external chart library — pure SVG for minimal bundle size.
 */

import { useMemo } from "react";
import type { AgentTrade } from "@/lib/types";

interface EquityChartProps {
  trades: AgentTrade[];
  initialBalance: number;
  className?: string;
}

export function EquityChart({
  trades,
  initialBalance,
  className,
}: EquityChartProps) {
  const points = useMemo(() => {
    // Build equity curve from trade history (oldest first)
    const sorted = [...trades].sort(
      (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
    );

    const curve: { x: number; y: number; label: string }[] = [
      { x: 0, y: initialBalance, label: "Start" },
    ];

    let equity = initialBalance;
    sorted.forEach((trade, i) => {
      equity += trade.pnl;
      curve.push({
        x: i + 1,
        y: equity,
        label: trade.symbol,
      });
    });

    return curve;
  }, [trades, initialBalance]);

  if (points.length < 2) {
    return (
      <div
        className={`flex h-40 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">No trades yet</p>
      </div>
    );
  }

  const width = 600;
  const height = 160;
  const padX = 50;
  const padY = 20;

  const values = points.map((p) => p.y);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const rangeY = maxY - minY || 1;
  const maxX = points.length - 1;

  const scaleX = (x: number) => padX + (x / maxX) * (width - padX * 2);
  const scaleY = (y: number) =>
    height - padY - ((y - minY) / rangeY) * (height - padY * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`)
    .join(" ");

  const lastEquity = points[points.length - 1].y;
  const isProfit = lastEquity >= initialBalance;
  const strokeColor = isProfit
    ? "var(--bullish-strong)"
    : "var(--bearish-strong)";

  // Baseline at initial balance
  const baselineY = scaleY(initialBalance);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        <line
          x1={padX}
          y1={baselineY}
          x2={width - padX}
          y2={baselineY}
          stroke="var(--border-subtle)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Baseline label */}
        <text
          x={padX - 4}
          y={baselineY + 3}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="10"
          fontFamily="var(--font-mono)"
        >
          {initialBalance.toLocaleString()}
        </text>

        {/* Min/Max labels */}
        <text
          x={padX - 4}
          y={scaleY(maxY) + 3}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="10"
          fontFamily="var(--font-mono)"
        >
          {maxY.toFixed(0)}
        </text>
        {Math.abs(scaleY(minY) - scaleY(maxY)) > 20 && (
          <text
            x={padX - 4}
            y={scaleY(minY) + 3}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            {minY.toFixed(0)}
          </text>
        )}

        {/* Equity line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point dot */}
        <circle
          cx={scaleX(maxX)}
          cy={scaleY(lastEquity)}
          r="3"
          fill={strokeColor}
        />
      </svg>
    </div>
  );
}
