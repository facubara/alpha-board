"use client";

/**
 * ComparisonEquityChart — Multi-line SVG equity curves for agent comparison.
 * SVG geometry + HTML text overlays + HTML legend.
 */

import { useMemo } from "react";
import type { AgentDetail, AgentTrade } from "@/lib/types";
import { getYAxisLabelVisibility } from "@/lib/chart-utils";

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

  const scaleX = (date: number) =>
    padX + ((date - minDate) / rangeDate) * (width - padX * 2);
  const scaleY = (y: number) =>
    height - padY - ((y - minY) / rangeY) * (height - padY * 2);

  const baselineY = scaleY(10000);
  const showBaselineRange = minY <= 10000 && maxY >= 10000;
  const maxLabelY = scaleY(maxY);
  const minLabelY = scaleY(minY);

  const { showBaseline, showMax, showMin } = getYAxisLabelVisibility(
    baselineY, maxLabelY, minLabelY
  );
  const showBaselineFinal = showBaseline && showBaselineRange;

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
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          preserveAspectRatio="none"
        >
          {/* Baseline at $10,000 */}
          {showBaselineRange && (
            <line
              x1={padX}
              y1={baselineY}
              x2={width - padX}
              y2={baselineY}
              stroke="var(--border-subtle)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          )}

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
        </svg>

        {/* Y-axis labels as HTML overlays */}
        {showBaselineFinal && (
          <span
            className="pointer-events-none absolute font-mono text-[9px] text-muted"
            style={{
              left: 0,
              width: `${(padX / width) * 100}%`,
              top: `${(baselineY / height) * 100}%`,
              transform: "translateY(-50%)",
              textAlign: "right",
              paddingRight: 4,
            }}
          >
            $10,000
          </span>
        )}
        {showMax && (
          <span
            className="pointer-events-none absolute font-mono text-[9px] text-muted"
            style={{
              left: 0,
              width: `${(padX / width) * 100}%`,
              top: `${(maxLabelY / height) * 100}%`,
              transform: "translateY(-50%)",
              textAlign: "right",
              paddingRight: 4,
            }}
          >
            ${maxY.toFixed(0)}
          </span>
        )}
        {showMin && (
          <span
            className="pointer-events-none absolute font-mono text-[9px] text-muted"
            style={{
              left: 0,
              width: `${(padX / width) * 100}%`,
              top: `${(minLabelY / height) * 100}%`,
              transform: "translateY(-50%)",
              textAlign: "right",
              paddingRight: 4,
            }}
          >
            ${minY.toFixed(0)}
          </span>
        )}

        {/* Date labels as HTML overlays */}
        {dateLabels.map((d, i) => (
          <span
            key={i}
            className="pointer-events-none absolute font-mono text-[9px] text-muted"
            style={{
              left: `${(d.x / width) * 100}%`,
              bottom: 0,
              transform: "translateX(-50%)",
              paddingBottom: 2,
            }}
          >
            {d.label}
          </span>
        ))}
      </div>

      {/* Legend as HTML flex row */}
      <div className="flex flex-wrap gap-4 px-3 pb-2 pt-1">
        {agents.map((agent) => {
          const points = curves[agent.id] ?? [];
          const finalEquity =
            points.length > 0 ? points[points.length - 1].equity : agent.initialBalance;
          return (
            <div key={agent.id} className="flex items-center gap-1.5">
              <div
                className="h-[3px] w-[10px] rounded-sm"
                style={{ backgroundColor: colorMap[agent.id] ?? "#888" }}
              />
              <span className="text-[9px] text-secondary">
                {agent.displayName} (${finalEquity.toFixed(0)})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
