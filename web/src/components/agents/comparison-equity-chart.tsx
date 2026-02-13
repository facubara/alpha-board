"use client";

/**
 * ComparisonEquityChart — Multi-line SVG equity curves for agent comparison.
 * Follows the same SVG pattern as ArchetypeCurvesChart and EquityChart.
 */

import { useMemo } from "react";
import type { AgentDetail, AgentTrade } from "@/lib/types";

interface ComparisonEquityChartProps {
  agents: AgentDetail[];
  trades: Record<number, AgentTrade[]>;
  colorMap: Record<number, string>;
  className?: string;
}

interface EquityPoint {
  date: number; // ms timestamp
  equity: number;
}

export function ComparisonEquityChart({
  agents,
  trades,
  colorMap,
  className,
}: ComparisonEquityChartProps) {
  const curves = useMemo(() => {
    const result: Record<number, EquityPoint[]> = {};

    for (const agent of agents) {
      const agentTrades = trades[agent.id] ?? [];
      const sorted = [...agentTrades].sort(
        (a, b) =>
          new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
      );

      const points: EquityPoint[] = [];
      let equity = agent.initialBalance;

      // Starting point: use first trade date minus 1ms, or agent creation
      const firstDate = sorted.length > 0
        ? new Date(sorted[0].closedAt).getTime() - 1
        : new Date(agent.createdAt).getTime();
      points.push({ date: firstDate, equity });

      for (const trade of sorted) {
        equity += trade.pnl;
        points.push({
          date: new Date(trade.closedAt).getTime(),
          equity,
        });
      }

      result[agent.id] = points;
    }

    return result;
  }, [agents, trades]);

  // Check if there's enough data
  const totalPoints = Object.values(curves).reduce(
    (sum, pts) => sum + pts.length,
    0
  );
  if (totalPoints < 4) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
      >
        <p className="text-xs text-muted">Not enough trades to compare</p>
      </div>
    );
  }

  // Compute global bounds
  const allPoints = Object.values(curves).flat();
  const allDates = allPoints.map((p) => p.date);
  const allEquities = allPoints.map((p) => p.equity);

  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const minY = Math.min(...allEquities);
  const maxY = Math.max(...allEquities);
  const rangeDate = maxDate - minDate || 1;
  const rangeY = maxY - minY || 1;

  const width = 700;
  const height = 200;
  const padX = 55;
  const padY = 20;
  const legendHeight = 28;
  const totalHeight = height + legendHeight;

  const scaleX = (date: number) =>
    padX + ((date - minDate) / rangeDate) * (width - padX * 2);
  const scaleY = (y: number) =>
    height - padY - ((y - minY) / rangeY) * (height - padY * 2);

  const baselineY = scaleY(10000);
  const showBaseline = minY <= 10000 && maxY >= 10000;

  // Date labels (4 evenly spaced)
  const dateLabels: { x: number; label: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const date = minDate + (i / 3) * rangeDate;
    dateLabels.push({
      x: scaleX(date),
      label: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    });
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className ?? ""}`}
    >
      <svg
        viewBox={`0 0 ${width} ${totalHeight}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        {/* Baseline at $10,000 */}
        {showBaseline && (
          <>
            <line
              x1={padX}
              y1={baselineY}
              x2={width - padX}
              y2={baselineY}
              stroke="var(--border-subtle)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={padX - 4}
              y={baselineY + 3}
              textAnchor="end"
              fill="var(--text-muted)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              $10,000
            </text>
          </>
        )}

        {/* Y-axis min/max */}
        <text
          x={padX - 4}
          y={scaleY(maxY) + 3}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          ${maxY.toFixed(0)}
        </text>
        {Math.abs(scaleY(minY) - scaleY(maxY)) > 20 && (
          <text
            x={padX - 4}
            y={scaleY(minY) + 3}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            ${minY.toFixed(0)}
          </text>
        )}

        {/* Date labels */}
        {dateLabels.map((d, i) => (
          <text
            key={i}
            x={d.x}
            y={height - 4}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            {d.label}
          </text>
        ))}

        {/* Equity lines per agent */}
        {agents.map((agent) => {
          const points = curves[agent.id] ?? [];
          if (points.length < 2) return null;
          const pathD = points
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"} ${scaleX(p.date)} ${scaleY(p.equity)}`
            )
            .join(" ");
          return (
            <path
              key={agent.id}
              d={pathD}
              fill="none"
              stroke={colorMap[agent.id] ?? "#888"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* End dots */}
        {agents.map((agent) => {
          const points = curves[agent.id] ?? [];
          if (points.length < 2) return null;
          const last = points[points.length - 1];
          return (
            <circle
              key={`dot-${agent.id}`}
              cx={scaleX(last.date)}
              cy={scaleY(last.equity)}
              r="3"
              fill={colorMap[agent.id] ?? "#888"}
            />
          );
        })}

        {/* Legend */}
        {agents.map((agent, i) => {
          const points = curves[agent.id] ?? [];
          const finalEquity =
            points.length > 0 ? points[points.length - 1].equity : agent.initialBalance;
          const legendX = padX + i * 160;
          const legendY = height + 16;
          return (
            <g key={`legend-${agent.id}`}>
              <rect
                x={legendX}
                y={legendY - 6}
                width="10"
                height="3"
                rx="1"
                fill={colorMap[agent.id] ?? "#888"}
              />
              <text
                x={legendX + 14}
                y={legendY}
                fill="var(--text-secondary)"
                fontSize="9"
                fontFamily="var(--font-geist-sans)"
              >
                {agent.displayName} (${finalEquity.toFixed(0)})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
