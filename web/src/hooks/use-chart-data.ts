"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChartDataResponse, Timeframe } from "@/lib/types";

interface UseChartDataParams {
  symbol: string;
  timeframe: Timeframe;
  limit?: number;
}

interface UseChartDataResult {
  data: ChartDataResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useChartData({
  symbol,
  timeframe,
  limit = 200,
}: UseChartDataParams): UseChartDataResult {
  const [data, setData] = useState<ChartDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/candles/${symbol.toUpperCase()}/${timeframe}?limit=${limit}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json: ChartDataResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chart data");
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
