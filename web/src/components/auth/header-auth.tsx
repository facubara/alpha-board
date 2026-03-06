"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

export function HeaderAuth() {
  const { isAuthenticated, logout, requireAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/settings"
          className="rounded-none px-3 py-2 font-mono text-sm text-text-secondary transition-colors-fast hover:bg-void-muted hover:text-text-primary"
        >
          [ Settings ]
        </Link>
        <button
          onClick={async () => {
            await logout();
            router.push("/");
          }}
          className="rounded-none px-3 py-2 font-mono text-sm text-text-secondary transition-colors-fast hover:bg-void-muted hover:text-text-primary"
        >
          [ DISCONNECT ]
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() =>
        requireAuth(() => {
          if (pathname === "/") router.push("/terminal");
        })
      }
      className="rounded-none px-3 py-2 font-mono text-sm text-text-secondary transition-colors-fast hover:bg-void-muted hover:text-text-primary"
    >
      [ INITIALIZE TERMINAL ]
    </button>
  );
}
