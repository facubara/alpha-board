"use client";

/**
 * NavLinks — Client component for header navigation.
 * Highlights the active link based on current pathname.
 * Collapses to hamburger menu on mobile.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Rankings" },
  { href: "/agents", label: "Agents" },
  { href: "/tweets", label: "Tweets" },
  { href: "/backtest", label: "Backtest" },
  { href: "/analytics", label: "Analytics" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function NavLinks() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-primary ${
                active
                  ? "bg-[var(--bg-elevated)] text-primary"
                  : "text-secondary"
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
        className="rounded-md p-2 text-secondary transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-primary sm:hidden"
        aria-label="Toggle navigation menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-14 z-50 border-b border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-2 sm:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors-fast hover:bg-[var(--bg-elevated)] hover:text-primary ${
                    active
                      ? "bg-[var(--bg-elevated)] text-primary"
                      : "text-secondary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
