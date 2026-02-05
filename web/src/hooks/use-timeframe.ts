"use client";

/**
 * useTimeframe Hook
 *
 * Client-side state for selected timeframe.
 * Switching timeframes is instant (no network request) because
 * all timeframe data is prefetched on the server.
 */

import { useState, useCallback } from "react";
import type { Timeframe } from "@/lib/types";

const DEFAULT_TIMEFRAME: Timeframe = "1h";

export function useTimeframe(initial: Timeframe = DEFAULT_TIMEFRAME) {
  const [timeframe, setTimeframe] = useState<Timeframe>(initial);

  const selectTimeframe = useCallback((tf: Timeframe) => {
    setTimeframe(tf);
  }, []);

  return {
    timeframe,
    setTimeframe: selectTimeframe,
  };
}
