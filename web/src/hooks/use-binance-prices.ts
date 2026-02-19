"use client";

/**
 * useBinancePrices Hook
 *
 * Polls Binance public REST API every 5 seconds for live symbol prices.
 * Returns a Map<string, number> of symbol -> price.
 */

import { useState, useEffect, useRef, useCallback } from "react";

const BINANCE_API = "https://api.binance.com/api/v3/ticker/price";
const POLL_INTERVAL = 5_000;

interface UseBinancePricesResult {
  prices: Map<string, number>;
  pricesReady: boolean;
}

export function useBinancePrices(symbols: string[]): UseBinancePricesResult {
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [pricesReady, setPricesReady] = useState(false);
  const symbolsKey = symbols.sort().join(",");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrices = useCallback(async () => {
    if (symbols.length === 0) return;

    try {
      const encoded = encodeURIComponent(JSON.stringify(symbols));
      const res = await fetch(`${BINANCE_API}?symbols=${encoded}`);
      if (!res.ok) return;

      const data: { symbol: string; price: string }[] = await res.json();
      const map = new Map<string, number>();
      for (const item of data) {
        map.set(item.symbol, parseFloat(item.price));
      }
      setPrices(map);
      setPricesReady(true);
    } catch {
      // Silently ignore fetch errors — will retry on next poll
    }
  }, [symbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (symbols.length === 0) {
      setPrices(new Map());
      setPricesReady(true);
      return;
    }

    // Fetch immediately on mount
    fetchPrices();

    // Poll every 5 seconds
    intervalRef.current = setInterval(fetchPrices, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPrices, symbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { prices, pricesReady };
}
