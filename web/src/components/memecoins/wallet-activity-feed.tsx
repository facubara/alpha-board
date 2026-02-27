"use client";

/**
 * WalletActivityFeed — Real-time wallet swap activity via SSE.
 */

import { useState, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { WalletActivity } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

interface WalletActivitySSEEvent {
  type: string;
  wallet?: { address: string; label: string | null; score: number };
  trade?: {
    tokenMint: string;
    tokenSymbol: string;
    tokenName: string;
    direction: string;
    amountSol: number;
    priceUsd: number | null;
    txSignature: string;
    blockTime: string;
  };
}

interface WalletActivityFeedProps {
  initialActivity: WalletActivity[];
}

export function WalletActivityFeed({ initialActivity }: WalletActivityFeedProps) {
  const [activity, setActivity] = useState<WalletActivity[]>(initialActivity);

  const handleSSE = useCallback((event: WalletActivitySSEEvent) => {
    if (event.type === "wallet_activity" && event.wallet && event.trade) {
      const newItem: WalletActivity = {
        id: Date.now(),
        walletId: 0,
        walletAddress: event.wallet.address,
        walletLabel: event.wallet.label,
        tokenMint: event.trade.tokenMint,
        tokenSymbol: event.trade.tokenSymbol,
        tokenName: event.trade.tokenName,
        direction: event.trade.direction as "buy" | "sell",
        amountSol: event.trade.amountSol,
        priceUsd: event.trade.priceUsd,
        txSignature: event.trade.txSignature,
        blockTime: event.trade.blockTime,
        detectedAt: new Date().toISOString(),
      };

      setActivity((prev) => [newItem, ...prev].slice(0, 100));
    }
  }, []);

  const { isConnected } = useSSE<WalletActivitySSEEvent>({
    url: `${WORKER_URL}/sse/memecoins`,
    enabled: !!WORKER_URL,
    onMessage: handleSSE,
  });

  function truncateAddr(addr: string): string {
    return addr.length > 10 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-primary">Live Activity</h3>
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isConnected ? "bg-[var(--status-connected)]" : "bg-[var(--status-disconnected)]"
          }`}
        />
      </div>

      {activity.length === 0 ? (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-muted">
          No wallet activity recorded yet.
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto space-y-1">
          {activity.map((item) => (
            <div
              key={item.txSignature}
              className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
            >
              <span className="font-mono text-secondary">
                {truncateAddr(item.walletAddress)}
              </span>
              <span
                className={`font-semibold ${
                  item.direction === "buy" ? "text-bullish" : "text-bearish"
                }`}
              >
                {item.direction === "buy" ? "bought" : "sold"}
              </span>
              {item.amountSol != null && (
                <span className="text-secondary">
                  {item.amountSol.toFixed(2)} SOL
                </span>
              )}
              <span className="text-muted">of</span>
              <span className="font-mono font-medium text-primary">
                ${item.tokenSymbol || "???"}
              </span>
              <span className="ml-auto text-muted">{getTimeAgo(item.blockTime)}</span>
              <a
                href={`https://solscan.io/tx/${item.txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                onClick={(e) => e.stopPropagation()}
              >
                tx
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
