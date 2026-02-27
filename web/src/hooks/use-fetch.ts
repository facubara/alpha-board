import { useState, useEffect, useCallback } from "react";

interface UseFetchOptions {
  pollInterval?: number;
}

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useFetch<T>(
  url: string | null,
  options?: UseFetchOptions
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
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

    const controller = new AbortController();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const doFetch = () => {
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json: T) => {
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
  }, [url, pollInterval, trigger]);

  return { data, loading, error, refetch };
}
