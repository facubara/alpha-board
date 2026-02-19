"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSSE } from "@/hooks/use-sse";
import type { TradeNotification } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;
const MAX_TRADES = 100;
const STORAGE_KEY = "alpha-board:trade-sidebar-open";

interface TradeSSEEvent {
  type: "connected" | "trade_opened" | "trade_closed";
  agentName?: string;
  agentId?: number;
  agentUuid?: string;
  engine?: string;
  symbol?: string;
  direction?: string;
  entryPrice?: number;
  exitPrice?: number;
  positionSize?: number;
  pnl?: number;
  pnlPct?: number;
  exitReason?: string;
  durationMinutes?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  confidence?: number | null;
  reasoningSummary?: string | null;
  timestamp?: string;
}

interface TradeNotificationContextValue {
  trades: TradeNotification[];
  unreadCount: number;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  markAllRead: () => void;
  latestToast: TradeNotification | null;
  dismissToast: () => void;
}

const TradeNotificationContext =
  createContext<TradeNotificationContextValue | null>(null);

export function useTradeNotifications() {
  const ctx = useContext(TradeNotificationContext);
  if (!ctx)
    throw new Error(
      "useTradeNotifications must be used within TradeNotificationProvider"
    );
  return ctx;
}

interface Props {
  initialTrades: TradeNotification[];
  children: React.ReactNode;
}

export function TradeNotificationProvider({ initialTrades, children }: Props) {
  const [trades, setTrades] = useState<TradeNotification[]>(initialTrades);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Sync with localStorage after hydration to avoid mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setSidebarOpen(stored === "true");
    }
  }, []);
  const [latestToast, setLatestToast] = useState<TradeNotification | null>(
    null
  );

  const sidebarOpenRef = useRef(sidebarOpen);
  sidebarOpenRef.current = sidebarOpen;

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSSEMessage = useCallback((data: TradeSSEEvent) => {
    if (data.type === "connected") return;
    if (data.type !== "trade_opened" && data.type !== "trade_closed") return;

    const notification: TradeNotification = {
      id: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: data.type,
      agentName: data.agentName || "",
      agentId: data.agentId || 0,
      agentUuid: data.agentUuid || "",
      engine: (data.engine as TradeNotification["engine"]) || "llm",
      symbol: data.symbol || "",
      direction: (data.direction as "long" | "short") || "long",
      entryPrice: data.entryPrice || 0,
      exitPrice: data.exitPrice ?? null,
      positionSize: data.positionSize || 0,
      pnl: data.pnl ?? null,
      pnlPct: data.pnlPct ?? null,
      exitReason: data.exitReason ?? null,
      durationMinutes: data.durationMinutes ?? null,
      stopLoss: data.stopLoss ?? null,
      takeProfit: data.takeProfit ?? null,
      confidence: data.confidence ?? null,
      reasoningSummary: data.reasoningSummary ?? null,
      timestamp: data.timestamp || new Date().toISOString(),
      isRead: sidebarOpenRef.current,
    };

    setTrades((prev) => [notification, ...prev].slice(0, MAX_TRADES));

    if (!sidebarOpenRef.current) {
      setUnreadCount((c) => c + 1);
      setLatestToast(notification);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setLatestToast(null), 4000);
    }
  }, []);

  useSSE<TradeSSEEvent>({
    url: `${WORKER_URL}/sse/trades`,
    enabled: !!WORKER_URL,
    onMessage: handleSSEMessage,
  });

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      if (next) {
        setUnreadCount(0);
        setTrades((t) => t.map((tr) => ({ ...tr, isRead: true })));
      }
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
    setTrades((t) => t.map((tr) => ({ ...tr, isRead: true })));
  }, []);

  const dismissToast = useCallback(() => {
    setLatestToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <TradeNotificationContext.Provider
      value={{
        trades,
        unreadCount,
        sidebarOpen,
        toggleSidebar,
        markAllRead,
        latestToast,
        dismissToast,
      }}
    >
      {children}
    </TradeNotificationContext.Provider>
  );
}
