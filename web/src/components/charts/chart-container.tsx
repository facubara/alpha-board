"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TIMEFRAMES, type Timeframe, type TradeMarker } from "@/lib/types";
import { useChartData } from "@/hooks/use-chart-data";
import { CandlestickChart } from "./candlestick-chart";
import { RefreshCw } from "lucide-react";

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
                "rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors",
                tf === timeframe
                  ? "bg-[var(--bg-elevated)] text-primary"
                  : "text-muted hover:text-secondary"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      )}

      {/* Chart area */}
      <div
        className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[#0B0E11]"
        style={{ minHeight: height }}
      >
        {loading && (
          <div
            className="flex items-center justify-center"
            style={{ height }}
          >
            <div className="flex items-center gap-2 text-sm text-muted">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading chart...
            </div>
          </div>
        )}

        {error && !loading && (
          <div
            className="flex flex-col items-center justify-center gap-3"
            style={{ height }}
          >
            <p className="text-sm text-muted">{error}</p>
            <button
              onClick={refetch}
              className="rounded bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:text-primary"
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
