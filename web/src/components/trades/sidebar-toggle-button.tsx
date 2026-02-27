"use client";

import { Bell } from "lucide-react";
import { useTradeNotifications } from "./trade-notification-provider";

export function SidebarToggleButton() {
  const { unreadCount, sidebarOpen, toggleSidebar } = useTradeNotifications();

  return (
    <button
      onClick={toggleSidebar}
      className={`relative flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
        sidebarOpen
          ? "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          : "bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25"
      }`}
      aria-label={sidebarOpen ? "Close trade feed" : "Open trade feed"}
    >
      <Bell className="h-4 w-4" />
      {!sidebarOpen && (
        <span className="hidden text-xs font-medium sm:inline">
          Trade Feed
        </span>
      )}
      {!sidebarOpen && unreadCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
