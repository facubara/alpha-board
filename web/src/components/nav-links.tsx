"use client";

/**
 * NavLinks — Client component for header navigation.
 * Highlights the active link based on current pathname.
 * Collapses to hamburger menu on mobile.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

const NAV_ITEMS = [
  { href: "/terminal", label: "Terminal" },
  { href: "/agents", label: "Agents" },
  { href: "/radar", label: "Radar" },
  { href: "/lab", label: "Laboratory" },
  { href: "/system", label: "System" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function NavLinks() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Hide nav on landing page for unauthenticated users
  const isMarketingView = pathname === "/" && !isAuthenticated;

  // Close mobile nav on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, closeMobile]);

  // On marketing view, don't render any navigation links
  if (isMarketingView) return null;

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-1 sm:flex">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-none border border-transparent font-mono text-xs px-2.5 py-1 transition-colors ${
                active
                  ? "border-terminal-amber text-terminal-amber bg-terminal-amber-muted"
                  : "text-text-secondary hover:text-text-primary hover:border-void-border"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen((o) => !o)}
        className="rounded-none p-2 text-text-secondary transition-colors hover:bg-void-muted hover:text-text-primary sm:hidden"
        aria-label="Toggle navigation menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile dropdown backdrop + menu */}
      {mobileOpen && (
        <>
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={closeMobile}
        />
        <div className="absolute left-0 right-0 top-14 z-50 border-b border-void-border bg-void px-4 py-2 sm:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-none border border-transparent font-mono text-xs px-2.5 py-1 transition-colors ${
                    active
                      ? "border-terminal-amber text-terminal-amber bg-terminal-amber-muted"
                      : "text-text-secondary hover:text-text-primary hover:border-void-border"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        </>
      )}
    </>
  );
}
