"use client";

import { Lock, LogOut } from "lucide-react";
import { useAuth } from "./auth-provider";

export function HeaderAuth() {
  const { isAuthenticated, logout, requireAuth } = useAuth();

  if (isAuthenticated) {
    return (
      <button
        onClick={() => logout()}
        className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-secondary transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-primary"
      >
        <LogOut className="h-3.5 w-3.5" />
        Logout
      </button>
    );
  }

  return (
    <button
      onClick={() => requireAuth(() => {})}
      className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-secondary transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-primary"
    >
      <Lock className="h-3.5 w-3.5" />
      Login
    </button>
  );
}
