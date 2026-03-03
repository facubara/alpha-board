import { useState, useEffect, useCallback } from "react";

interface UseFetchOptions {
  pollInterval?: number;
  /** Cache TTL in seconds. Default 60. Set to 0 to disable cache reads. */
  cacheTTL?: number;
}

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ── Module-level stale-while-revalidate cache ──────────────────────────
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function readCache<T>(url: string, ttlSeconds: number): T | null {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlSeconds * 1000) return null;
  return entry.data as T;
}

function writeCache(url: string, data: unknown): void {
  cache.set(url, { data, timestamp: Date.now() });
}

// ────────────────────────────────────────────────────────────────────────

export function useFetch<T>(
  url: string | null,
  options?: UseFetchOptions
): UseFetchResult<T> {
  const cacheTTL = options?.cacheTTL ?? 60;
  const cached = url && cacheTTL > 0 ? readCache<T>(url, cacheTTL) : null;

  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(url ? !cached : false);
  const [error, setError] = useState<Error | null>(null);
  const [trigger, setTrigger] = useState(0);
  const pollInterval = options?.pollInterval;

  const refetch = useCallback(() => {
    setTrigger((n) => n + 1);
    setLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // On mount / url change, serve from cache if fresh
    const hit = cacheTTL > 0 ? readCache<T>(url, cacheTTL) : null;
    if (hit) {
      setData(hit);
      setLoading(false);
    }

    const controller = new AbortController();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const doFetch = () => {
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json: T) => {
          writeCache(url, json);
          setData(json);
          setError(null);
          setLoading(false);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        });
    };

    doFetch();

    if (pollInterval && pollInterval > 0) {
      intervalId = setInterval(doFetch, pollInterval);
    }

    return () => {
      controller.abort();
      if (intervalId) clearInterval(intervalId);
    };
  }, [url, pollInterval, trigger, cacheTTL]);

  return { data, loading, error, refetch };
}
