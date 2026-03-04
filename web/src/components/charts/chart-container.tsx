"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TIMEFRAMES, type Timeframe, type TradeMarker } from "@/lib/types";
import { useChartData } from "@/hooks/use-chart-data";
import { CandlestickChart } from "./candlestick-chart";
import { TextLoader } from "@/components/terminal";

interface ChartContainerProps {
  symbol: string;
  initialTimeframe?: Timeframe;
  tradeMarkers?: TradeMarker[];
  showTimeframeSelector?: boolean;
  height?: number;
}

export function ChartContainer({
  symbol,
  initialTimeframe = "1h",
  tradeMarkers,
  showTimeframeSelector = true,
  height = 500,
}: ChartContainerProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const { data, loading, error, refetch } = useChartData({
    symbol,
    timeframe,
  });

  return (
    <div className="space-y-3">
      {/* Timeframe selector */}
      {showTimeframeSelector && (
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "rounded-none border border-transparent px-2.5 py-1 font-mono text-xs font-medium transition-colors",
                tf === timeframe
                  ? "border-terminal-amber text-terminal-amber bg-terminal-amber-muted"
                  : "text-text-tertiary hover:text-text-secondary hover:border-void-border"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      )}

      {/* Chart area */}
      <div
        className="overflow-hidden rounded-none border border-void-border bg-void-surface"
        style={{ minHeight: height }}
      >
        {loading && (
          <div
            className="flex items-center justify-center"
            style={{ height }}
          >
            <TextLoader text="Loading chart..." />
          </div>
        )}

        {error && !loading && (
          <div
            className="flex flex-col items-center justify-center gap-3"
            style={{ height }}
          >
            <p className="text-sm text-text-tertiary font-mono">{error}</p>
            <button
              onClick={refetch}
              className="rounded-none border border-void-border bg-void-muted px-3 py-1.5 text-xs font-mono text-text-secondary transition-colors hover:text-text-primary hover:border-terminal-amber"
            >
              Retry
            </button>
          </div>
        )}

        {data && !loading && !error && (
          <CandlestickChart
            data={data}
            height={height}
            tradeMarkers={tradeMarkers}
          />
        )}
      </div>
    </div>
  );
}
