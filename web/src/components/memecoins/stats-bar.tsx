"use client";

import { useSSE } from "@/hooks/use-sse";
import type { MemecoinStats } from "@/lib/types";
import { useCallback, useState } from "react";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

interface StatsBarProps {
  stats: MemecoinStats;
}

function StatValue({ value, subtitle }: { value: number; subtitle?: string }) {
  if (value === 0) {
    return (
      <div>
        <div className="mt-1 text-lg font-semibold text-text-primary">&mdash;</div>
        {subtitle && <div className="text-xs text-text-tertiary">{subtitle}</div>}
      </div>
    );
  }
  return <div className="mt-1 text-lg font-semibold text-text-primary">{value}</div>;
}

export function StatsBar({ stats }: StatsBarProps) {
  const [liveConnected, setLiveConnected] = useState(false);

  const handleSSE = useCallback(() => {
    // We just use this to track connection status
  }, []);

  const { isConnected } = useSSE({
    url: `${WORKER_URL}/sse/memecoins`,
    enabled: !!WORKER_URL,
    onMessage: handleSSE,
  });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
        <div className="text-xs text-text-tertiary">Wallets Tracked</div>
        <StatValue value={stats.walletsTracked} subtitle="No wallets yet" />
      </div>
      <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
        <div className="text-xs text-text-tertiary">Avg Hit Rate</div>
        <StatValue value={stats.avgHitRate} subtitle="Collecting data" />
      </div>
      <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
        <div className="text-xs text-text-tertiary">Tweets Today</div>
        <StatValue value={stats.tweetsToday} subtitle="Feed paused" />
      </div>
      <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
        <div className="text-xs text-text-tertiary">Token Matches</div>
        <StatValue value={stats.tokenMatchesToday} subtitle="Awaiting signals" />
      </div>
      <div className="rounded-none border border-void-border bg-void-surface px-4 py-3">
        <div className="text-xs text-text-tertiary">Live Feed</div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isConnected ? "bg-[#10B981]" : "bg-[#52525B]"
            }`}
          />
          <span className="text-sm text-text-secondary">
            {isConnected ? "Connected" : "Offline"}
          </span>
        </div>
      </div>
    </div>
  );
}
