import { useState, useEffect, useRef } from "react";

interface UseDebouncedFetchResult<T> {
  data: T | null;
  loading: boolean;
}

export function useDebouncedFetch<T>(
  url: string | null,
  delay: number = 300
): UseDebouncedFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(() => {
      const controller = new AbortController();

      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json: T) => {
          setData(json);
          setLoading(false);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setData(null);
          setLoading(false);
        });

      // Store abort for cleanup
      timerRef.current = null;
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [url, delay]);

  return { data, loading };
}
