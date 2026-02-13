"use client";

import { useState, useEffect } from "react";
import type { Timeframe } from "@/lib/types";

interface CandleCountdownProps {
  timeframe: Timeframe;
}

const INTERVAL_MS: Record<Timeframe, number> = {
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

function getNextCandleClose(timeframe: Timeframe): number {
  const now = Date.now();

  if (timeframe === "1w") {
    // Binance weekly candles close Monday 00:00 UTC
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    // Monday = 1; advance to next Monday
    const day = d.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 && now <= d.getTime() ? 0 : 8 - day;
    d.setUTCDate(d.getUTCDate() + daysUntilMonday);
    // If we're exactly on the boundary, jump to next week
    if (d.getTime() <= now) {
      d.setUTCDate(d.getUTCDate() + 7);
    }
    return d.getTime();
  }

  const interval = INTERVAL_MS[timeframe];
  return Math.ceil(now / interval) * interval;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "closing...";

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function CandleCountdown({ timeframe }: CandleCountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      const closeTime = getNextCandleClose(timeframe);
      setRemaining(Math.max(0, closeTime - Date.now()));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeframe]);

  if (remaining === null) return null;

  return (
    <span className="font-mono text-xs text-secondary">
      Next close{" "}
      <span className="text-primary">{formatCountdown(remaining)}</span>
    </span>
  );
}
