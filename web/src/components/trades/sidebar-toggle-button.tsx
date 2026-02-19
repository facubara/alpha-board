"use client";

import { Bell } from "lucide-react";
import { useTradeNotifications } from "./trade-notification-provider";

export function SidebarToggleButton() {
  const { unreadCount, sidebarOpen, toggleSidebar } = useTradeNotifications();

  return (
    <button
      onClick={toggleSidebar}
      className="relative rounded-md p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
      aria-label={sidebarOpen ? "Close trade feed" : "Open trade feed"}
    >
      <Bell className="h-4 w-4" />
      {!sidebarOpen && unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
