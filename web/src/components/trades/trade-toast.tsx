"use client";

import { useTradeNotifications } from "./trade-notification-provider";

export function TradeToast() {
  const { latestToast, dismissToast, toggleSidebar, sidebarOpen } =
    useTradeNotifications();

  if (!latestToast || sidebarOpen) return null;

  const isLong = latestToast.direction === "long";
  const isOpen = latestToast.type === "trade_opened";

  return (
    <button
      onClick={() => {
        dismissToast();
        toggleSidebar();
      }}
      className="animate-in slide-in-from-right fixed bottom-4 right-4 z-50 flex max-w-xs items-center gap-2.5 rounded-none border border-void-border bg-void-surface px-3.5 py-2.5 transition-opacity hover:opacity-90"
    >
      {/* Direction indicator */}
      <span
        className={`shrink-0 rounded-none px-1.5 py-0.5 text-xs font-mono font-medium uppercase ${
          isLong
            ? "bg-terminal-amber-muted text-data-profit"
            : "bg-terminal-amber-muted text-data-loss"
        }`}
      >
        {latestToast.direction}
      </span>

      {/* Details */}
      <div className="min-w-0 text-left">
        <div className="text-xs font-medium text-text-primary font-mono">
          {isOpen ? "Opened" : "Closed"}{" "}
          {latestToast.symbol.replace("USDT", "")}
        </div>
        <div className="truncate text-xs text-text-secondary font-mono">
          {latestToast.agentName}
          {!isOpen && latestToast.pnl !== null && (
            <span
              className={`ml-1 font-mono ${
                latestToast.pnl >= 0 ? "text-data-profit" : "text-data-loss"
              }`}
            >
              {latestToast.pnl >= 0 ? "+" : ""}${latestToast.pnl.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
