"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  ColorType,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import type { ChartDataResponse, TradeMarker } from "@/lib/types";

interface CandlestickChartProps {
  data: ChartDataResponse;
  height?: number;
  showVolume?: boolean;
  showEMA?: boolean;
  showBollingerBands?: boolean;
  tradeMarkers?: TradeMarker[];
}

function toUnixSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

export function CandlestickChart({
  data,
  height = 500,
  showVolume = true,
  showEMA = true,
  showBollingerBands = true,
  tradeMarkers,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#0B0E11" },
        textColor: "#888888",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#1C1C1C" },
        horzLines: { color: "#1C1C1C" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#1C1C1C",
      },
      timeScale: {
        borderColor: "#1C1C1C",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick series (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    const candleData = data.candles.map((c) => ({
      time: toUnixSeconds(c.openTime) as import("lightweight-charts").UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeries.setData(candleData);
    seriesRef.current = candleSeries;

    // Trade markers (v5: createSeriesMarkers)
    if (tradeMarkers && tradeMarkers.length > 0) {
      const markers = tradeMarkers
        .map((m) => ({
          time: m.time as import("lightweight-charts").UTCTimestamp,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(candleSeries, markers);
    }

    // Volume histogram
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      volumeSeries.setData(
        data.candles.map((c) => ({
          time: toUnixSeconds(c.openTime) as import("lightweight-charts").UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
        }))
      );
    }

    // EMA overlays
    if (showEMA) {
      const emaConfigs = [
        { values: data.indicators.ema20, color: "#3B82F6" },
        { values: data.indicators.ema50, color: "#F59E0B" },
        { values: data.indicators.ema200, color: "#8B5CF6" },
      ];

      for (const cfg of emaConfigs) {
        const lineData = data.candles
          .map((c, i) =>
            cfg.values[i] !== null
              ? {
                  time: toUnixSeconds(c.openTime) as import("lightweight-charts").UTCTimestamp,
                  value: cfg.values[i] as number,
                }
              : null
          )
          .filter(Boolean) as { time: import("lightweight-charts").UTCTimestamp; value: number }[];

        if (lineData.length > 0) {
          const series = chart.addSeries(LineSeries, {
            color: cfg.color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          series.setData(lineData);
        }
      }
    }

    // Bollinger Bands
    if (showBollingerBands) {
      const bbConfigs = [
        { values: data.indicators.bbUpper },
        { values: data.indicators.bbMiddle },
        { values: data.indicators.bbLower },
      ];

      for (const cfg of bbConfigs) {
        const lineData = data.candles
          .map((c, i) =>
            cfg.values[i] !== null
              ? {
                  time: toUnixSeconds(c.openTime) as import("lightweight-charts").UTCTimestamp,
                  value: cfg.values[i] as number,
                }
              : null
          )
          .filter(Boolean) as { time: import("lightweight-charts").UTCTimestamp; value: number }[];

        if (lineData.length > 0) {
          const series = chart.addSeries(LineSeries, {
            color: "#6B6B6B",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          series.setData(lineData);
        }
      }
    }

    chart.timeScale().fitContent();

    // ResizeObserver for responsive width
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [data, height, showVolume, showEMA, showBollingerBands, tradeMarkers]);

  return <div ref={containerRef} className="w-full" role="img" aria-label="Price chart" />;
}
