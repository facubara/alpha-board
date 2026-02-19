"use client";

/**
 * CopyTradeButton — Execute button on trade_opened signals.
 *
 * Shows inline confirmation → calls POST /exchange/execute → shows result.
 */

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { TradeNotification } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

interface Props {
  trade: TradeNotification;
  exchangeEnabled: boolean;
}

export function CopyTradeButton({ trade, exchangeEnabled }: Props) {
  const { requireAuth } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  if (!exchangeEnabled || trade.type !== "trade_opened") return null;

  const handleExecute = () => {
    requireAuth(async () => {
      setExecuting(true);
      setResult(null);
      try {
        const res = await fetch(`${WORKER_URL}/exchange/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: trade.symbol,
            direction: trade.direction,
            size_usd: trade.positionSize,
            stop_loss: trade.stopLoss,
            take_profit: trade.takeProfit,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setResult({
            ok: true,
            message: `Filled — Order #${data.orderId}`,
          });
          setConfirming(false);
        } else {
          setResult({ ok: false, message: data.detail || "Failed" });
        }
      } catch (e) {
        setResult({
          ok: false,
          message: e instanceof Error ? e.message : "Network error",
        });
      } finally {
        setExecuting(false);
      }
    });
  };

  if (result) {
    return (
      <div
        className={`mt-1.5 rounded px-2.5 py-1.5 text-xs ${
          result.ok
            ? "bg-green-500/10 text-green-400"
            : "bg-red-500/10 text-red-400"
        }`}
      >
        {result.message}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="mt-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-2 space-y-1.5">
        <div className="text-xs text-[var(--text-secondary)]">
          <span className="font-medium">Execute on Binance?</span>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono">
            <span>
              {trade.symbol} {trade.direction.toUpperCase()}
            </span>
            <span>${trade.positionSize.toFixed(2)}</span>
            {trade.stopLoss && <span>SL: {trade.stopLoss}</span>}
            {trade.takeProfit && <span>TP: {trade.takeProfit}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExecute}
            disabled={executing}
            className="rounded bg-green-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {executing ? "Sending..." : "Confirm"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={executing}
            className="rounded border border-[var(--border-default)] px-3 py-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="mt-1.5 flex items-center gap-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-3.5 w-3.5"
      >
        <path d="M16.624 13.921l2.746 2.746-6.746 6.746H9.878v-2.746l6.746-6.746zm5.292-.456l-1.588-1.588a.632.632 0 00-.898 0l-1.344 1.344 2.746 2.746 1.344-1.344a.85.85 0 00-.26-.658zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.34 0 .68-.02 1.01-.05L12 20.94V18h-1v-2h2v-1.08L16.92 11H17V9h-5V7h2.48L12.02 2.02C12.01 2.01 12.01 2 12 2z" />
      </svg>
      Execute
    </button>
  );
}
