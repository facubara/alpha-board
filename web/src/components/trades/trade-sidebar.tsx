"use client";

import { X } from "lucide-react";
import { useTradeNotifications } from "./trade-notification-provider";
import { TradeItem } from "./trade-item";

export function TradeSidebar() {
  const { trades, sidebarOpen, toggleSidebar, markAllRead, exchangeEnabled } =
    useTradeNotifications();

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed bottom-0 right-0 top-14 z-40 w-full border-l border-[var(--border-default)] bg-[var(--bg-base)] transition-transform duration-200 ease-in-out sm:w-96 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-10 items-center justify-between border-b border-[var(--border-default)] px-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-[var(--text-primary)]">
              Trade Feed
            </h2>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {trades.length} trades
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={markAllRead}
              className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
            >
              Mark read
            </button>
            <button
              onClick={toggleSidebar}
              className="rounded p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
              aria-label="Close trade feed"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Trade list */}
        <div className="h-[calc(100%-2.5rem)] overflow-y-auto">
          {trades.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-[var(--text-tertiary)]">
              No trades yet
            </div>
          ) : (
            trades.map((trade) => (
              <TradeItem
                key={trade.id}
                trade={trade}
                exchangeEnabled={exchangeEnabled}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
