"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseSSEOptions<T> {
  url: string;
  enabled?: boolean;
  onMessage: (data: T) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseSSEReturn {
  isConnected: boolean;
  error: string | null;
  reconnectCount: number;
}

/**
 * React hook for Server-Sent Events with automatic reconnection.
 *
 * Connects to the given SSE URL, parses JSON events, and calls onMessage.
 * Automatically reconnects on error up to maxReconnectAttempts times.
 */
export function useSSE<T>({
  url,
  enabled = true,
  onMessage,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
}: UseSSEOptions<T>): UseSSEReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const onMessageRef = useRef(onMessage);

  // Keep onMessage ref current to avoid stale closures
  onMessageRef.current = onMessage;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !url) {
      cleanup();
      setIsConnected(false);
      return;
    }

    function connect() {
      cleanup();

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectCountRef.current = 0;
        setReconnectCount(0);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as T;
          onMessageRef.current(data);
        } catch {
          // Ignore unparseable messages (e.g. keepalives won't hit here)
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setIsConnected(false);

        if (reconnectCountRef.current < maxReconnectAttempts) {
          reconnectCountRef.current += 1;
          setReconnectCount(reconnectCountRef.current);
          setError(`Disconnected. Reconnecting (${reconnectCountRef.current}/${maxReconnectAttempts})...`);

          reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
        } else {
          setError("Connection lost. Refresh to retry.");
        }
      };
    }

    connect();

    return cleanup;
  }, [url, enabled, reconnectInterval, maxReconnectAttempts, cleanup]);

  return { isConnected, error, reconnectCount };
}
