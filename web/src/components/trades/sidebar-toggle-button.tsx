"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useTradeNotifications } from "./trade-notification-provider";

export function SidebarToggleButton() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { unreadCount, sidebarOpen, toggleSidebar } = useTradeNotifications();

  // Hide trade feed on landing page for unauthenticated users
  if (pathname === "/" && !isAuthenticated) return null;

  return (
    <button
      onClick={toggleSidebar}
      className={`relative flex items-center gap-1.5 rounded-none px-2 py-1.5 transition-colors ${
        sidebarOpen
          ? "text-terminal-amber bg-terminal-amber-muted"
          : "text-text-secondary hover:text-text-primary hover:bg-void-muted"
      }`}
      aria-label={sidebarOpen ? "Close trade feed" : "Open trade feed"}
    >
      <Bell className="h-4 w-4" />
      {!sidebarOpen && (
        <span className="hidden text-xs font-mono sm:inline">
          Trade Feed
        </span>
      )}
      {!sidebarOpen && unreadCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-none bg-data-loss px-1 text-xs font-mono font-medium text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
