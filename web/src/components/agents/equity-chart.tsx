"use client";

/**
 * EquityChart Component
 *
 * Simple SVG line chart showing equity curve derived from trade history.
 * SVG geometry + HTML text overlays for crisp labels.
 */

import { useMemo } from "react";
import type { AgentTrade } from "@/lib/types";
import { getYAxisLabelVisibility } from "@/lib/chart-utils";

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
  const maxLabelY = scaleY(maxY);
  const minLabelY = scaleY(minY);

  const { showBaseline, showMax, showMin } = getYAxisLabelVisibility(
    baselineY, maxLabelY, minLabelY
  );

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Equity curve"
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

        {/* Y-axis labels as HTML overlays */}
        {showBaseline && (
          <span
            className="pointer-events-none absolute font-mono text-xs text-muted"
            style={{
              left: 0,
              width: `${(padX / width) * 100}%`,
              top: `${(baselineY / height) * 100}%`,
              transform: "translateY(-50%)",
              textAlign: "right",
              paddingRight: 4,
            }}
          >
            {initialBalance.toLocaleString()}
          </span>
        )}
        {showMax && (
          <span
            className="pointer-events-none absolute font-mono text-xs text-muted"
            style={{
              left: 0,
              width: `${(padX / width) * 100}%`,
              top: `${(maxLabelY / height) * 100}%`,
              transform: "translateY(-50%)",
              textAlign: "right",
              paddingRight: 4,
            }}
          >
            {maxY.toFixed(0)}
          </span>
        )}
        {showMin && (
          <span
            className="pointer-events-none absolute font-mono text-xs text-muted"
            style={{
              left: 0,
              width: `${(padX / width) * 100}%`,
              top: `${(minLabelY / height) * 100}%`,
              transform: "translateY(-50%)",
              textAlign: "right",
              paddingRight: 4,
            }}
          >
            {minY.toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}
