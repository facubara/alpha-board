"use client";

/**
 * ComparisonView — Main wrapper for agent comparison.
 * Renders agent chips, metrics, equity chart, PnL bars, and trade table.
 */

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComparisonData } from "@/lib/types";
import { ComparisonEquityChart } from "./comparison-equity-chart";
import { ComparisonMetrics } from "./comparison-metrics";
import { ComparisonTrades } from "./comparison-trades";
import { HorizontalBarChart } from "../analytics/horizontal-bar-chart";

export const COMPARISON_COLORS = [
  "#3B82F6",
  "#F59E0B",
  "#A855F7",
  "#06B6D4",
];

interface ComparisonViewProps {
  data: ComparisonData;
}

export function ComparisonView({ data }: ComparisonViewProps) {
  const router = useRouter();
  const [activeIds, setActiveIds] = useState<number[]>(() =>
    data.agents.map((a) => a.id)
  );

  const visibleAgents = useMemo(
    () => data.agents.filter((a) => activeIds.includes(a.id)),
    [data.agents, activeIds]
  );

  const colorMap = useMemo(() => {
    const map: Record<number, string> = {};
    data.agents.forEach((agent, i) => {
      map[agent.id] = COMPARISON_COLORS[i % COMPARISON_COLORS.length];
    });
    return map;
  }, [data.agents]);

  const handleRemove = (id: number) => {
    const next = activeIds.filter((aid) => aid !== id);
    if (next.length < 2) {
      router.push("/agents");
      return;
    }
    setActiveIds(next);
    router.replace(`/agents/compare?ids=${next.join(",")}`);
  };

  const pnlItems = visibleAgents.map((a) => ({
    label: a.displayName,
    value: a.totalRealizedPnl,
  }));

  return (
    <div className="space-y-6">
      {/* Agent chips */}
      <div className="flex flex-wrap gap-2">
        {data.agents.map((agent) => {
          const isActive = activeIds.includes(agent.id);
          const color = colorMap[agent.id];
          return (
            <button
              key={agent.id}
              onClick={() => handleRemove(agent.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs font-medium transition-colors-fast ${
                isActive
                  ? "border-[var(--border-strong)] bg-[var(--bg-surface)] text-primary"
                  : "border-[var(--border-subtle)] text-muted opacity-50"
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {agent.displayName}
              {isActive && <X className="h-3 w-3 text-secondary" />}
            </button>
          );
        })}
      </div>

      {/* Metrics comparison */}
      <ComparisonMetrics agents={visibleAgents} colorMap={colorMap} />

      {/* Equity curves */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-primary">
          Equity Curves
        </h2>
        <ComparisonEquityChart
          agents={visibleAgents}
          trades={data.trades}
          colorMap={colorMap}
        />
      </div>

      {/* PnL bars */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-primary">
          Total PnL
        </h2>
        <HorizontalBarChart
          items={pnlItems}
          formatValue={(v) =>
            `${v >= 0 ? "+" : ""}$${v.toFixed(2)}`
          }
        />
      </div>

      {/* Trade timeline */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-primary">
          Trade Timeline
        </h2>
        <ComparisonTrades
          agents={visibleAgents}
          trades={data.trades}
          colorMap={colorMap}
        />
      </div>
    </div>
  );
}
